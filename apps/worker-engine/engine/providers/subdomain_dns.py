"""
Subdomain & DNS Intelligence Provider (Task 1.2)
Queries Certificate Transparency logs via crt.sh and resolves DNS records
(A, AAAA, CNAME, MX) via Cloudflare DNS-over-HTTPS (1.1.1.1).
Includes fallback prefix resolution and dangling CNAME takeover detection.
"""

from typing import AsyncGenerator, Dict, Any, List, Set, Optional
import asyncio
import httpx
import logging

from engine.core.base_provider import BaseOSINTProvider, provider_registry
from engine.core.security import is_safe_hostname
from engine.models.entities import (
    EntityType,
    SeverityLevel,
    TelemetryLevel,
)

logger = logging.getLogger("iseeyou.providers.subdomain_dns")

# Well-known services frequently associated with dangling CNAME takeovers
TAKEOVER_PATTERNS = {
    "github.io": "GitHub Pages",
    "herokuapp.com": "Heroku App",
    "s3.amazonaws.com": "AWS S3 Bucket",
    "s3-website": "AWS S3 Static Website",
    "azurewebsites.net": "Azure App Service",
    "pantheonsite.io": "Pantheon Hosting",
    "zendesk.com": "Zendesk Help Center",
    "readme.io": "ReadMe Docs",
    "surge.sh": "Surge.sh Deployment",
    "bitbucket.io": "Bitbucket Cloud",
    "ghost.io": "Ghost Publication",
    "myshopify.com": "Shopify Store",
}

# Fallback top subdomains if Certificate Transparency is congested/unreachable
FALLBACK_PREFIXES = [
    "www",
    "mail",
    "api",
    "app",
    "dev",
    "staging",
    "admin",
    "vpn",
    "portal",
    "auth",
    "cdn",
    "test",
    "status",
    "git",
    "remote",
]


class SubdomainDNSResolver(BaseOSINTProvider):
    """
    Asynchronous OSINT Worker for Subdomain Discovery and DNS Topology Mapping.
    Utilizes crt.sh Certificate Transparency and Cloudflare DoH (1.1.1.1).
    """

    CRTSH_URL = "https://crt.sh/"
    CERTSPOTTER_URL = "https://api.certspotter.com/v1/issuances"
    CLOUDFLARE_DOH_URL = "https://cloudflare-dns.com/dns-query"

    def __init__(
        self,
        max_subdomains_to_resolve: int = 50,
        concurrency_limit: int = 10,
        timeout_seconds: float = 15.0,
    ):
        super().__init__(
            name="subdomain_dns_resolver",
            display_name="Subdomain & DNS Intelligence",
            supported_types=[EntityType.DOMAIN, EntityType.SUBDOMAIN],
            timeout_seconds=timeout_seconds,
        )
        self.max_subdomains_to_resolve = max_subdomains_to_resolve
        self.semaphore = asyncio.Semaphore(concurrency_limit)

    async def _fetch_crtsh_subdomains(
        self, domain: str, client: httpx.AsyncClient
    ) -> Set[str]:
        """
        Queries crt.sh Certificate Transparency JSON endpoint for wildcard and sub certificates
        """
        discovered: Set[str] = set()
        url = f"{self.CRTSH_URL}?q=%.{domain}&output=json"

        try:
            response = await client.get(url, timeout=12.0)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    for entry in data:
                        name_value = entry.get("name_value", "")
                        for raw_sub in name_value.splitlines():
                            clean_sub = raw_sub.strip().lower()
                            # Strip wildcards (*.example.com -> example.com)
                            if clean_sub.startswith("*."):
                                clean_sub = clean_sub[2:]
                            # Ensure it belongs to the target domain
                            if clean_sub.endswith(domain) and clean_sub != domain:
                                discovered.add(clean_sub)
        except Exception as e:
            logger.warning(f"crt.sh lookup failed or timed out for {domain}: {e}")

        return discovered

    async def _fetch_certspotter_subdomains(
        self, domain: str, client: httpx.AsyncClient
    ) -> Set[str]:
        """
        Queries CertSpotter API as a reliable secondary Certificate Transparency provider.
        """
        discovered: Set[str] = set()
        url = f"{self.CERTSPOTTER_URL}?domain={domain}&include_subdomains=true&expand=dns_names"

        try:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    for entry in data:
                        for dns_name in entry.get("dns_names", []):
                            clean_sub = dns_name.strip().lower()
                            if clean_sub.startswith("*."):
                                clean_sub = clean_sub[2:]
                            if clean_sub.endswith(domain) and clean_sub != domain:
                                discovered.add(clean_sub)
        except Exception as e:
            logger.debug(f"CertSpotter lookup error for {domain}: {e}")

        return discovered

    async def _resolve_dns_record(
        self,
        name: str,
        record_type: str,
        client: httpx.AsyncClient,
    ) -> List[Dict[str, Any]]:
        """
        Resolves DNS records via Cloudflare DoH JSON API (1.1.1.1)
        Record types: 'A', 'AAAA', 'CNAME', 'MX'
        """
        async with self.semaphore:
            try:
                params = {"name": name, "type": record_type}
                headers = {"Accept": "application/dns-json"}
                response = await client.get(
                    self.CLOUDFLARE_DOH_URL,
                    params=params,
                    headers=headers,
                    timeout=6.0,
                )
                if response.status_code == 200:
                    data = response.json()
                    # Status 0 = NOERROR
                    if data.get("Status") == 0 and "Answer" in data:
                        return data["Answer"]
            except Exception as e:
                logger.debug(f"DoH query error for {name} ({record_type}): {e}")

            return []

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Main reconnaissance execution pipeline:
        1. Query crt.sh Certificate Transparency logs
        2. Fallback to common prefixes if crt.sh is unreachable
        3. Parallel DNS resolution (A, AAAA, CNAME, MX) via Cloudflare DoH
        4. Dangling CNAME takeover evaluation
        5. Emits normalized Node and Edge graph elements
        """
        target = target.lower().strip()

        # Anti-SSRF Defense Gate: Do not resolve internal hostnames or DNS rebinding domains
        safe, reason = is_safe_hostname(target)
        if not safe:
            yield self.create_log(
                TelemetryLevel.WARN,
                f"SSRF Shield: '{target}' is blocked ({reason}). Subdomain reconnaissance aborted.",
            )
            return

        root_node_id = f"domain:{target}"

        # 1. Spawn root domain node on canvas
        yield self.create_node(
            node_id=root_node_id,
            entity_type=EntityType.DOMAIN,
            value=target,
            label=target,
            severity=SeverityLevel.INFO,
            metadata={"role": "root_target"},
        )

        async with self.get_http_client() as client:
            yield self.create_log(
                TelemetryLevel.INFO,
                f"Querying dual Certificate Transparency providers (crt.sh & CertSpotter) for '{target}'...",
            )

            crtsh_task = self._fetch_crtsh_subdomains(target, client)
            certspotter_task = self._fetch_certspotter_subdomains(target, client)
            res_crtsh, res_certspotter = await asyncio.gather(
                crtsh_task, certspotter_task, return_exceptions=True
            )

            discovered_subdomains: Set[str] = set()
            sources_reported = []

            if isinstance(res_crtsh, set) and res_crtsh:
                discovered_subdomains.update(res_crtsh)
                sources_reported.append(f"crt.sh ({len(res_crtsh)})")
            if isinstance(res_certspotter, set) and res_certspotter:
                discovered_subdomains.update(res_certspotter)
                sources_reported.append(f"CertSpotter ({len(res_certspotter)})")

            if discovered_subdomains:
                yield self.create_log(
                    TelemetryLevel.SUCCESS,
                    f"Certificate Transparency discovered {len(discovered_subdomains)} unique subdomain(s) via {', '.join(sources_reported)}.",
                )
            else:
                yield self.create_log(
                    TelemetryLevel.WARN,
                    f"No subdomains indexed in public CT logs. Probing standard DNS prefixes (www, api, mail, etc.)...",
                )
                # Fallback to high-value prefixes
                discovered_subdomains = {f"{prefix}.{target}" for prefix in FALLBACK_PREFIXES}

            # Prioritize subdomains (e.g. www first) and cap to configured limit
            sorted_subs = sorted(
                list(discovered_subdomains),
                key=lambda s: (0 if s.startswith(f"www.{target}") else 1, len(s)),
            )[: self.max_subdomains_to_resolve]

            yield self.create_log(
                TelemetryLevel.INFO,
                f"Resolving DNS records (A, CNAME, MX) for {len(sorted_subs)} subdomains via Cloudflare DoH (1.1.1.1)...",
            )

            # Resolve root domain records first
            root_a_records = await self._resolve_dns_record(target, "A", client)
            for record in root_a_records:
                ip_val = record.get("data")
                if ip_val:
                    ip_node_id = f"ip:{ip_val}"
                    yield self.create_node(
                        node_id=ip_node_id,
                        entity_type=EntityType.IP,
                        value=ip_val,
                        label=ip_val,
                        severity=SeverityLevel.INFO,
                        parent_id=root_node_id,
                        metadata={"record_type": "A", "ttl": record.get("TTL")},
                    )
                    yield self.create_edge(
                        edge_id=f"edge:{root_node_id}->{ip_node_id}",
                        source=root_node_id,
                        target=ip_node_id,
                        relation="resolves_to_ip",
                    )

            # Resolve MX records for root domain
            root_mx_records = await self._resolve_dns_record(target, "MX", client)
            for record in root_mx_records:
                mx_val = record.get("data", "").rstrip(".")
                if mx_val:
                    mx_node_id = f"subdomain:{mx_val}"
                    yield self.create_node(
                        node_id=mx_node_id,
                        entity_type=EntityType.SUBDOMAIN,
                        value=mx_val,
                        label=f"MX: {mx_val}",
                        severity=SeverityLevel.INFO,
                        parent_id=root_node_id,
                        metadata={"record_type": "MX"},
                    )
                    yield self.create_edge(
                        edge_id=f"edge:{root_node_id}->{mx_node_id}",
                        source=root_node_id,
                        target=mx_node_id,
                        relation="mail_exchanger",
                    )

            # Parallel resolution of discovered subdomains
            for sub in sorted_subs:
                sub_node_id = f"subdomain:{sub}"

                # Query A records and CNAME records
                a_task = self._resolve_dns_record(sub, "A", client)
                cname_task = self._resolve_dns_record(sub, "CNAME", client)
                a_answers, cname_answers = await asyncio.gather(a_task, cname_task)

                # If either A or CNAME resolved, this is an active alive subdomain
                is_active = bool(a_answers or cname_answers)
                if not is_active:
                    continue

                yield self.create_node(
                    node_id=sub_node_id,
                    entity_type=EntityType.SUBDOMAIN,
                    value=sub,
                    label=sub,
                    severity=SeverityLevel.INFO,
                    parent_id=root_node_id,
                    metadata={"active": True},
                )
                yield self.create_edge(
                    edge_id=f"edge:{root_node_id}->{sub_node_id}",
                    source=root_node_id,
                    target=sub_node_id,
                    relation="has_subdomain",
                )

                # Link resolved IPs
                for answer in a_answers:
                    ip_val = answer.get("data")
                    if ip_val:
                        ip_node_id = f"ip:{ip_val}"
                        yield self.create_node(
                            node_id=ip_node_id,
                            entity_type=EntityType.IP,
                            value=ip_val,
                            label=ip_val,
                            severity=SeverityLevel.INFO,
                            parent_id=sub_node_id,
                            metadata={"record_type": "A", "ttl": answer.get("TTL")},
                        )
                        yield self.create_edge(
                            edge_id=f"edge:{sub_node_id}->{ip_node_id}",
                            source=sub_node_id,
                            target=ip_node_id,
                            relation="resolves_to_ip",
                        )

                # Inspect CNAME records for potential dangling takeovers
                for answer in cname_answers:
                    cname_val = answer.get("data", "").rstrip(".")
                    if cname_val:
                        # Check against known takeover provider signatures
                        for pattern, service_name in TAKEOVER_PATTERNS.items():
                            if pattern in cname_val.lower():
                                yield self.create_finding(
                                    finding_id=f"takeover-vector:{sub}",
                                    node_id=sub_node_id,
                                    title=f"External Cloud Dependency: {service_name}",
                                    severity=SeverityLevel.LOW,
                                    evidence=f"Subdomain '{sub}' points via CNAME to external resource: {cname_val}",
                                )
                                break


# Register singleton instance in central provider registry
provider_registry.register(SubdomainDNSResolver())

