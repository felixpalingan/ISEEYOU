"""
IP Geolocation & Threat Intelligence Provider (Task 1.3)
Integrates ip-api.com for Geolocation, ISP, and ASN profiling,
and Shodan InternetDB for zero-auth passive open port enumeration and CVE detection.
"""

from typing import AsyncGenerator, Dict, Any, List, Optional
import httpx
import logging

from engine.core.base_provider import BaseOSINTProvider, provider_registry
from engine.core.security import is_safe_ip
from engine.models.entities import (
    EntityType,
    SeverityLevel,
    TelemetryLevel,
)

logger = logging.getLogger("iseeyou.providers.ip_intel")

# Well-known ports with cybersecurity risk classification
PORT_RISK_MAP: Dict[int, Dict[str, Any]] = {
    21: {"service": "FTP", "severity": SeverityLevel.MEDIUM, "desc": "Insecure plaintext FTP protocol"},
    22: {"service": "SSH", "severity": SeverityLevel.INFO, "desc": "Secure Shell remote admin"},
    23: {"service": "Telnet", "severity": SeverityLevel.CRITICAL, "desc": "Cleartext Telnet admin (High Risk)"},
    25: {"service": "SMTP", "severity": SeverityLevel.INFO, "desc": "Mail Transfer Protocol"},
    53: {"service": "DNS", "severity": SeverityLevel.INFO, "desc": "Domain Name System"},
    80: {"service": "HTTP", "severity": SeverityLevel.INFO, "desc": "Plaintext Web Server"},
    443: {"service": "HTTPS", "severity": SeverityLevel.INFO, "desc": "Encrypted Web Server"},
    445: {"service": "SMB", "severity": SeverityLevel.CRITICAL, "desc": "Exposed SMB/CIFS File Sharing"},
    1433: {"service": "MS-SQL", "severity": SeverityLevel.CRITICAL, "desc": "Exposed Microsoft SQL Server"},
    1521: {"service": "Oracle-DB", "severity": SeverityLevel.CRITICAL, "desc": "Exposed Oracle Database"},
    3306: {"service": "MySQL", "severity": SeverityLevel.HIGH, "desc": "Exposed MySQL Database Port"},
    3389: {"service": "RDP", "severity": SeverityLevel.HIGH, "desc": "Exposed Windows Remote Desktop (RDP)"},
    5432: {"service": "PostgreSQL", "severity": SeverityLevel.HIGH, "desc": "Exposed PostgreSQL Database Port"},
    5900: {"service": "VNC", "severity": SeverityLevel.HIGH, "desc": "Exposed VNC Remote Desktop"},
    6379: {"service": "Redis", "severity": SeverityLevel.CRITICAL, "desc": "Exposed Unauthenticated Redis Instance"},
    8080: {"service": "HTTP-Proxy", "severity": SeverityLevel.INFO, "desc": "Alternative Web Server/Proxy"},
    8443: {"service": "HTTPS-Alt", "severity": SeverityLevel.INFO, "desc": "Alternative HTTPS Web Server"},
    9200: {"service": "Elasticsearch", "severity": SeverityLevel.HIGH, "desc": "Exposed Elasticsearch Cluster"},
    27017: {"service": "MongoDB", "severity": SeverityLevel.CRITICAL, "desc": "Exposed MongoDB NoSQL Database"},
}


class IPThreatIntelProvider(BaseOSINTProvider):
    """
    Asynchronous OSINT Worker for IP Geolocation, Network Owner / ASN identification,
    and passive vulnerability / port reconnaissance.
    Uses free public endpoints: ip-api.com and Shodan InternetDB.
    """

    IP_API_URL = "http://ip-api.com/json"
    SHODAN_INTERNETDB_URL = "https://internetdb.shodan.io"
    CLOUDFLARE_DOH_URL = "https://cloudflare-dns.com/dns-query"

    def __init__(self, timeout_seconds: float = 15.0):
        super().__init__(
            name="ip_threat_intel",
            display_name="IP Geolocation & Threat Intel",
            supported_types=[EntityType.IP, EntityType.DOMAIN, EntityType.SUBDOMAIN],
            timeout_seconds=timeout_seconds,
        )

    async def _resolve_ip_from_domain(
        self, domain: str, client: httpx.AsyncClient
    ) -> Optional[str]:
        """Resolves target domain to an A record IP via Cloudflare DoH"""
        try:
            params = {"name": domain, "type": "A"}
            headers = {"Accept": "application/dns-json"}
            response = await client.get(
                self.CLOUDFLARE_DOH_URL,
                params=params,
                headers=headers,
                timeout=5.0,
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("Status") == 0 and "Answer" in data:
                    for answer in data["Answer"]:
                        if answer.get("type") == 1:  # Type 1 = A
                            return answer.get("data")
        except Exception as e:
            logger.debug(f"DoH resolution failed for {domain}: {e}")
        return None

    async def _fetch_geolocation(
        self, ip: str, client: httpx.AsyncClient
    ) -> Dict[str, Any]:
        """Queries ip-api.com for ISP, country, city, ASN, and coordinates"""
        try:
            url = f"{self.IP_API_URL}/{ip}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query"
            response = await client.get(url, timeout=7.0)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    return data
        except Exception as e:
            logger.warning(f"Geolocation lookup failed for {ip}: {e}")
        return {}

    async def _fetch_shodan_internetdb(
        self, ip: str, client: httpx.AsyncClient
    ) -> Dict[str, Any]:
        """Queries Shodan InternetDB for passive open ports and CVEs"""
        try:
            url = f"{self.SHODAN_INTERNETDB_URL}/{ip}"
            response = await client.get(url, timeout=7.0)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                # 404 indicates no indexed vulnerabilities or exposures in Shodan
                return {"ports": [], "vulns": [], "cpes": [], "tags": []}
        except Exception as e:
            logger.warning(f"Shodan InternetDB lookup failed for {ip}: {e}")
        return {"ports": [], "vulns": [], "cpes": [], "tags": []}

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes IP intelligence gathering:
        1. Resolves IP if target is a domain/subdomain
        2. Retrieves Geolocation, ISP, ASN, and coordinates via ip-api.com
        3. Retrieves passive open ports and CVEs via Shodan InternetDB
        4. Identifies exposed database/admin services and attaches vulnerability findings
        5. Emits enriched Node and Edge entities
        """
        target = target.strip()
        ip_address = target

        async with self.get_http_client() as client:
            # If target is domain/subdomain, resolve to IPv4 address first
            if target_type in (EntityType.DOMAIN, EntityType.SUBDOMAIN):
                yield self.create_log(
                    TelemetryLevel.INFO,
                    f"Resolving IP address for domain target '{target}'...",
                )
                resolved = await self._resolve_ip_from_domain(target, client)
                if not resolved:
                    yield self.create_log(
                        TelemetryLevel.WARN,
                        f"Could not resolve an IPv4 address for '{target}'. Skipping IP threat intelligence.",
                    )
                    return
                ip_address = resolved
                yield self.create_log(
                    TelemetryLevel.INFO,
                    f"Resolved '{target}' to primary IP: {ip_address}",
                )

            # Anti-SSRF Defense Gate: Never query internal, loopback, or metadata addresses
            safe, reason = is_safe_ip(ip_address)
            if not safe:
                yield self.create_log(
                    TelemetryLevel.WARN,
                    f"SSRF Shield: '{ip_address}' is classified as internal/unsafe ({reason}). Outbound intel queries aborted.",
                )
                return

            ip_node_id = f"ip:{ip_address}"

            # Step 1: Geolocation & ASN
            yield self.create_log(
                TelemetryLevel.INFO,
                f"Querying Geolocation and Autonomous System (ASN) profile for {ip_address}...",
            )
            geo = await self._fetch_geolocation(ip_address, client)

            country = geo.get("country", "Unknown")
            city = geo.get("city", "Unknown")
            isp = geo.get("isp", "Unknown ISP")
            asn = geo.get("as", "Unknown ASN")
            lat = geo.get("lat")
            lon = geo.get("lon")

            geo_summary = f"{city}, {country} ({isp} | {asn})"
            yield self.create_log(
                TelemetryLevel.SUCCESS,
                f"Network Origin: {geo_summary}",
            )

            # Spawn/Enrich IP Node with full telemetry metadata
            yield self.create_node(
                node_id=ip_node_id,
                entity_type=EntityType.IP,
                value=ip_address,
                label=f"{ip_address} ({city}, {country})",
                severity=SeverityLevel.INFO,
                metadata={
                    "country": country,
                    "city": city,
                    "isp": isp,
                    "asn": asn,
                    "latitude": lat,
                    "longitude": lon,
                    "organization": geo.get("org", isp),
                },
            )

            # Link with domain if seed was a domain
            if target_type in (EntityType.DOMAIN, EntityType.SUBDOMAIN):
                domain_node_id = f"domain:{target}"
                yield self.create_edge(
                    edge_id=f"edge:{domain_node_id}->{ip_node_id}",
                    source=domain_node_id,
                    target=ip_node_id,
                    relation="hosts_infrastructure",
                )

            # Step 2: Shodan InternetDB Passive Ports & CVEs
            yield self.create_log(
                TelemetryLevel.INFO,
                f"Querying Shodan InternetDB for exposed ports and active CVE vulnerabilities on {ip_address}...",
            )
            shodan_data = await self._fetch_shodan_internetdb(ip_address, client)
            open_ports: List[int] = shodan_data.get("ports", [])
            vulns: List[str] = shodan_data.get("vulns", [])
            cpes: List[str] = shodan_data.get("cpes", [])

            if open_ports:
                yield self.create_log(
                    TelemetryLevel.WARN if any(p in PORT_RISK_MAP and PORT_RISK_MAP[p]["severity"] in (SeverityLevel.HIGH, SeverityLevel.CRITICAL) for p in open_ports) else TelemetryLevel.INFO,
                    f"Shodan InternetDB discovered {len(open_ports)} open port(s): {sorted(open_ports)}",
                )
            else:
                yield self.create_log(
                    TelemetryLevel.SUCCESS,
                    f"No open ports or public exposures indexed by Shodan for {ip_address}.",
                )

            # Map open ports to graph nodes & risk findings
            for port in sorted(open_ports):
                port_node_id = f"port:{ip_address}:{port}"
                risk_info = PORT_RISK_MAP.get(
                    port,
                    {"service": f"Port {port}", "severity": SeverityLevel.INFO, "desc": f"Open TCP Port {port}"},
                )

                port_severity = risk_info["severity"]
                port_label = f":{port} ({risk_info['service']})"

                yield self.create_node(
                    node_id=port_node_id,
                    entity_type=EntityType.PORT,
                    value=str(port),
                    label=port_label,
                    severity=port_severity,
                    parent_id=ip_node_id,
                    metadata={
                        "port": port,
                        "service": risk_info["service"],
                        "description": risk_info["desc"],
                    },
                )

                yield self.create_edge(
                    edge_id=f"edge:{ip_node_id}->{port_node_id}",
                    source=ip_node_id,
                    target=port_node_id,
                    relation="exposes_port",
                )

                # If port is High or Critical risk, emit explicit VulnerabilityFinding
                if port_severity in (SeverityLevel.HIGH, SeverityLevel.CRITICAL):
                    yield self.create_finding(
                        finding_id=f"exposed-port:{ip_address}:{port}",
                        node_id=port_node_id,
                        title=f"Publicly Exposed {risk_info['service']} Service (Port {port})",
                        severity=port_severity,
                        evidence=f"Critical service {risk_info['service']} on port {port} is exposed to the public Internet on {ip_address}. {risk_info['desc']}",
                    )

            # Step 3: Handle CVE Vulnerabilities
            if vulns:
                yield self.create_log(
                    TelemetryLevel.ERROR,
                    f"CRITICAL: {len(vulns)} CVE vulnerabilities indexed for {ip_address}: {', '.join(vulns[:5])}{'...' if len(vulns) > 5 else ''}",
                )
                for cve in vulns:
                    yield self.create_finding(
                        finding_id=f"cve:{ip_address}:{cve}",
                        node_id=ip_node_id,
                        title=f"Unpatched Vulnerability: {cve}",
                        severity=SeverityLevel.HIGH,
                        cve_id=cve,
                        evidence=f"Shodan threat intelligence confirmed host {ip_address} is affected by CVE {cve}. Associated software CPEs: {', '.join(cpes[:3]) if cpes else 'N/A'}",
                    )


# Register singleton instance in central provider registry
provider_registry.register(IPThreatIntelProvider())

