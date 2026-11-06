"""
Breach & Credential Hunter Provider (Task 1.4)
Implements HaveIBeenPwned k-anonymity SHA-1 hash range queries,
ethical credential masking (e.g. pa****rd123), verified victim domain correlation,
and real-time domain email spoofing defense audits (SPF & DMARC via Cloudflare DoH).
"""

from typing import AsyncGenerator, Dict, Any, List, Optional
import hashlib
import httpx
import logging

from engine.core.base_provider import BaseOSINTProvider, provider_registry
from engine.models.entities import (
    EntityType,
    SeverityLevel,
    TelemetryLevel,
)

logger = logging.getLogger("iseeyou.providers.breach_hunter")

# Reference catalog of major historical public breach corpuses with verified victim domains
HISTORICAL_BREACH_CATALOG = [
    {
        "name": "Collection #1",
        "year": 2019,
        "victim_domains": [],  # Multi-source compilation, not a single domain
        "records": "773 Million",
        "data_classes": ["Email addresses", "Passwords"],
        "severity": SeverityLevel.CRITICAL,
        "description": "Massive compilation of over 2.6 billion leaked credential pairs circulating in underground forums.",
    },
    {
        "name": "Exploit.in Dump",
        "year": 2016,
        "victim_domains": [],
        "records": "593 Million",
        "data_classes": ["Email addresses", "Plaintext Passwords"],
        "severity": SeverityLevel.CRITICAL,
        "description": "Large-scale credential combo-list extracted from multiple database penetrations.",
    },
    {
        "name": "LinkedIn Breach Archive",
        "year": 2016,
        "victim_domains": ["linkedin.com"],
        "records": "164 Million",
        "data_classes": ["Email addresses", "SHA1 Password Hashes"],
        "severity": SeverityLevel.HIGH,
        "description": "Historical corporate directory dump with unsalted and salted SHA1 password hashes.",
    },
    {
        "name": "Adobe Systems Exposure",
        "year": 2013,
        "victim_domains": ["adobe.com"],
        "records": "153 Million",
        "data_classes": ["Email addresses", "Password Hints", "Encrypted Passwords"],
        "severity": SeverityLevel.HIGH,
        "description": "Systemic infiltration compromising user IDs, passwords, and password hint records.",
    },
    {
        "name": "Canva Security Incident",
        "year": 2019,
        "victim_domains": ["canva.com"],
        "records": "139 Million",
        "data_classes": ["Email addresses", "Usernames", "Bcrypt Hashes"],
        "severity": SeverityLevel.MEDIUM,
        "description": "Exposed customer database containing usernames, emails, and salted bcrypt hashes.",
    },
]


def mask_credential(secret: str) -> str:
    """
    Masks credential strings for safe display according to cybersecurity ethics:
    - 'password123' -> 'pa*******23'
    - 'admin' -> 'ad*in'
    - 'short' -> 's***t'
    """
    if not secret:
        return "******"
    length = len(secret)
    if length <= 2:
        return "**"
    elif length <= 4:
        return f"{secret[0]}{'*' * (length - 2)}{secret[-1]}"
    elif length <= 7:
        return f"{secret[:2]}{'*' * (length - 3)}{secret[-1]}"
    else:
        return f"{secret[:2]}{'*' * (length - 4)}{secret[-2:]}"


class BreachCredentialHunter(BaseOSINTProvider):
    """
    OSINT Worker for Data Breach and Credential Exposure Intelligence.
    Uses HIBP k-anonymity protocol (zero credential leakage over the network),
    verifies genuine victim domain breaches, and audits domain anti-spoofing policies (SPF/DMARC).
    """

    HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range"
    CLOUDFLARE_DOH_URL = "https://cloudflare-dns.com/dns-query"

    def __init__(self, timeout_seconds: float = 12.0):
        super().__init__(
            name="breach_credential_hunter",
            display_name="Breach & Credential Hunter",
            supported_types=[EntityType.EMAIL, EntityType.USERNAME, EntityType.DOMAIN],
            timeout_seconds=timeout_seconds,
        )

    def _hash_sha1(self, plaintext: str) -> str:
        """Computes uppercase 40-character hexadecimal SHA-1 digest"""
        return hashlib.sha1(plaintext.encode("utf-8")).hexdigest().upper()

    async def query_k_anonymity_count(
        self, sha1_hash: str, client: httpx.AsyncClient
    ) -> int:
        """
        Executes k-anonymity query against HIBP Pwned Passwords API.
        Sends only the first 5 characters of the SHA-1 hash to preserve anonymity.
        Returns the occurrence count of the matched suffix, or 0 if not exposed.
        """
        sha1_hash = sha1_hash.strip().upper()
        if len(sha1_hash) != 40:
            return 0

        prefix = sha1_hash[:5]
        suffix = sha1_hash[5:]
        url = f"{self.HIBP_RANGE_URL}/{prefix}"

        try:
            headers = {"Add-Padding": "true", "User-Agent": self.DEFAULT_USER_AGENT}
            response = await client.get(url, headers=headers, timeout=6.0)

            if response.status_code == 200:
                for line in response.text.splitlines():
                    parts = line.strip().split(":")
                    if len(parts) == 2:
                        hash_suffix, count_str = parts[0].strip(), parts[1].strip()
                        if hash_suffix == suffix:
                            return int(count_str)
        except Exception as e:
            logger.warning(f"k-anonymity HIBP query failed for prefix {prefix}: {e}")

        return 0

    async def _query_dns_txt(
        self, name: str, client: httpx.AsyncClient
    ) -> List[str]:
        """Queries DNS TXT records via Cloudflare DoH (1.1.1.1)"""
        try:
            params = {"name": name, "type": "TXT"}
            headers = {"Accept": "application/dns-json"}
            res = await client.get(
                self.CLOUDFLARE_DOH_URL, params=params, headers=headers, timeout=5.0
            )
            if res.status_code == 200:
                data = res.json()
                if data.get("Status") == 0 and "Answer" in data:
                    return [
                        ans.get("data", "").strip('"')
                        for ans in data["Answer"]
                        if ans.get("type") == 16  # TXT record type
                    ]
        except Exception as e:
            logger.debug(f"DoH TXT resolution error for {name}: {e}")
        return []

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Main reconnaissance execution:
        - For DOMAIN: Audits real SPF & DMARC anti-spoofing policies and matches genuine breached victim domains.
        - For EMAIL/USERNAME: Audits handle-derived candidate hygiene via HIBP k-anonymity.
        """
        target = target.strip()
        root_node_id = f"{target_type.value}:{target}"

        # 1. Spawn root target node
        yield self.create_node(
            node_id=root_node_id,
            entity_type=target_type,
            value=target,
            label=target,
            severity=SeverityLevel.INFO,
            metadata={"role": "credential_seed"},
        )

        async with self.get_http_client() as client:
            yield self.create_log(
                TelemetryLevel.INFO,
                f"Initiating credential exposure audit for [{target_type.value.upper()}]: {target}",
            )

            # Case A: Target is a DOMAIN
            if target_type == EntityType.DOMAIN:
                yield self.create_log(
                    TelemetryLevel.INFO,
                    f"Auditing email security authentication records (SPF & DMARC) for '{target}'...",
                )

                # Check if target domain genuinely matches any known historical breach victims
                matched_breaches = [
                    b
                    for b in HISTORICAL_BREACH_CATALOG
                    if target.lower() in b.get("victim_domains", [])
                ]

                for breach in matched_breaches:
                    breach_id = f"breach:{breach['name'].lower().replace(' ', '_').replace('#', '')}"
                    yield self.create_node(
                        node_id=breach_id,
                        entity_type=EntityType.BREACH,
                        value=breach["name"],
                        label=f"{breach['name']} ({breach['year']})",
                        severity=breach["severity"],
                        parent_id=root_node_id,
                        metadata={
                            "breach_year": breach["year"],
                            "total_records": breach["records"],
                            "data_classes": breach["data_classes"],
                            "description": breach["description"],
                        },
                    )
                    yield self.create_edge(
                        edge_id=f"edge:{root_node_id}->{breach_id}",
                        source=root_node_id,
                        target=breach_id,
                        relation="exposed_in_breach",
                    )
                    yield self.create_finding(
                        finding_id=f"breach-finding:{target}:{breach_id}",
                        node_id=breach_id,
                        title=f"Target Organization Confirmed in {breach['name']} ({breach['year']})",
                        severity=breach["severity"],
                        evidence=(
                            f"Domain '{target}' is a documented victim in {breach['name']}. "
                            f"Exposed data: {', '.join(breach['data_classes'])}. Total records: {breach['records']}."
                        ),
                    )

                if not matched_breaches:
                    yield self.create_log(
                        TelemetryLevel.SUCCESS,
                        f"Domain '{target}' has 0 confirmed public corporate breach exposures indexed.",
                    )

                # Real-Time Domain Email Authentication & Anti-Spoofing Audit (SPF & DMARC)
                root_txt = await self._query_dns_txt(target, client)
                dmarc_txt = await self._query_dns_txt(f"_dmarc.{target}", client)

                spf_record = next((t for t in root_txt if t.startswith("v=spf1")), None)
                dmarc_record = next((t for t in dmarc_txt if "v=DMARC1" in t), None)

                # 1. SPF Evaluation
                if not spf_record:
                    yield self.create_finding(
                        finding_id=f"missing-spf:{target}",
                        node_id=root_node_id,
                        title="Missing SPF Record (Email Spoofing Risk)",
                        severity=SeverityLevel.LOW,
                        evidence=(
                            f"No SPF (v=spf1) TXT record was detected for '{target}'. "
                            "Receiving mail servers cannot cryptographically verify if outbound messages originate from an authorized mail exchanger."
                        ),
                    )
                    yield self.create_log(
                        TelemetryLevel.WARN,
                        f"SPF Record MISSING for '{target}'. Domain is vulnerable to unauthorized sender spoofing.",
                    )
                elif "+all" in spf_record:
                    yield self.create_finding(
                        finding_id=f"permissive-spf:{target}",
                        node_id=root_node_id,
                        title="Insecure Permissive SPF Configuration (+all)",
                        severity=SeverityLevel.HIGH,
                        evidence=(
                            f"Domain '{target}' publishes an overly permissive SPF record: '{spf_record}'. "
                            "The '+all' directive explicitly allows any computer on the Internet to send legitimate email as '{target}'."
                        ),
                    )
                else:
                    yield self.create_log(
                        TelemetryLevel.SUCCESS,
                        f"Valid SPF email authorization record detected for '{target}': {spf_record[:60]}...",
                    )

                # 2. DMARC Evaluation
                if not dmarc_record:
                    yield self.create_finding(
                        finding_id=f"missing-dmarc:{target}",
                        node_id=root_node_id,
                        title="Missing DMARC Policy (Phishing & Impersonation Vector)",
                        severity=SeverityLevel.MEDIUM,
                        evidence=(
                            f"No DMARC TXT record detected at '_dmarc.{target}'. "
                            "Without DMARC policy enforcement (p=quarantine or p=reject), malicious actors can forge email headers impersonating '{target}'."
                        ),
                    )
                    yield self.create_log(
                        TelemetryLevel.WARN,
                        f"DMARC Policy MISSING at '_dmarc.{target}'. Domain lacks phishing defense.",
                    )
                else:
                    yield self.create_log(
                        TelemetryLevel.SUCCESS,
                        f"Enforced DMARC policy detected at '_dmarc.{target}': {dmarc_record[:60]}...",
                    )

                return

            # Case B: Target is EMAIL or USERNAME
            local_handle = target.split("@")[0] if target_type == EntityType.EMAIL else target

            yield self.create_log(
                TelemetryLevel.INFO,
                f"Cross-referencing target handle '{local_handle}' against breach intelligence...",
            )

            # Privileged account detection (e.g. admin@, ceo@, security@)
            is_privileged = any(
                p in local_handle.lower()
                for p in ["admin", "root", "ceo", "finance", "hr", "support", "security", "dev"]
            )
            if is_privileged:
                yield self.create_log(
                    TelemetryLevel.WARN,
                    f"Target '{target}' identified as a HIGH-VALUE PRIVILEGED account. Prioritizing credential exposure checks.",
                )

            # Check if domain of email matches victim domains
            if target_type == EntityType.EMAIL and "@" in target:
                domain_part = target.split("@")[1].lower()
                matched_breaches = [
                    b for b in HISTORICAL_BREACH_CATALOG if domain_part in b.get("victim_domains", [])
                ]
                for breach in matched_breaches:
                    breach_id = f"breach:{breach['name'].lower().replace(' ', '_').replace('#', '')}"
                    yield self.create_node(
                        node_id=breach_id,
                        entity_type=EntityType.BREACH,
                        value=breach["name"],
                        label=f"{breach['name']} ({breach['year']})",
                        severity=breach["severity"],
                        parent_id=root_node_id,
                        metadata={
                            "breach_year": breach["year"],
                            "total_records": breach["records"],
                            "data_classes": breach["data_classes"],
                            "description": breach["description"],
                        },
                    )
                    yield self.create_edge(
                        edge_id=f"edge:{root_node_id}->{breach_id}",
                        source=root_node_id,
                        target=breach_id,
                        relation="exposed_in_breach",
                    )
                    yield self.create_finding(
                        finding_id=f"breach-finding:{target}:{breach_id}",
                        node_id=breach_id,
                        title=f"Account Domain Associated with {breach['name']} ({breach['year']})",
                        severity=breach["severity"],
                        evidence=f"Email domain '{domain_part}' corresponds to {breach['name']}.",
                    )

            # HIBP k-Anonymity Password Hygiene Audit (Target-derived patterns only)
            yield self.create_log(
                TelemetryLevel.INFO,
                f"Performing k-anonymity hash queries via HIBP range API for handle '{local_handle}'...",
            )

            # Candidate passwords strictly derived from the target handle (never generic static passwords)
            candidate_passwords = [
                f"{local_handle}123",
                f"{local_handle}2024",
                f"{local_handle}!",
            ]

            exposed_candidates_count = 0
            for candidate in candidate_passwords:
                sha1 = self._hash_sha1(candidate)
                occurrences = await self.query_k_anonymity_count(sha1, client)

                if occurrences > 0:
                    exposed_candidates_count += 1
                    masked_pwd = mask_credential(candidate)

                    finding_severity = (
                        SeverityLevel.CRITICAL if occurrences > 5000 else SeverityLevel.HIGH
                    )

                    # Spawn a verified Breach node for the leak occurrence
                    breach_node_id = f"breach:pwned_{local_handle}_{sha1[:6]}"
                    yield self.create_node(
                        node_id=breach_node_id,
                        entity_type=EntityType.BREACH,
                        value="Pwned Passwords Leak",
                        label=f"Exposed Credential ({masked_pwd})",
                        severity=finding_severity,
                        parent_id=root_node_id,
                        metadata={
                            "occurrences": occurrences,
                            "masked_pattern": masked_pwd,
                            "sha1_prefix": sha1[:5],
                        },
                    )

                    yield self.create_edge(
                        edge_id=f"edge:{root_node_id}->{breach_node_id}",
                        source=root_node_id,
                        target=breach_node_id,
                        relation="exposed_in_breach",
                    )

                    yield self.create_finding(
                        finding_id=f"pwned-credential:{local_handle}:{sha1[:8]}",
                        node_id=breach_node_id,
                        title="Weak Credential Pattern Identified in Global Breach Corpus",
                        severity=finding_severity,
                        evidence=(
                            f"Associated pattern '{masked_pwd}' was observed {occurrences:,} times "
                            f"in public credential leaks. SHA-1 prefix verified via HIBP k-anonymity ({sha1[:5]}...)."
                        ),
                    )

            if exposed_candidates_count > 0:
                yield self.create_log(
                    TelemetryLevel.WARN,
                    f"Identified {exposed_candidates_count} handle-derived credential pattern(s) actively present in breach dumps.",
                )
            else:
                yield self.create_log(
                    TelemetryLevel.SUCCESS,
                    "No immediate handle-derived credential patterns verified in public breach range database.",
                )


# Register singleton instance in central provider registry
provider_registry.register(BreachCredentialHunter())
