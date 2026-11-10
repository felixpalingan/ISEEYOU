"""
Wayback Machine Historical Footprint & Archive Crawler Provider
Discovers historical snapshots, archived user profiles, and deleted websites
using Archive.org's Wayback Machine Availability API.
"""

from typing import AsyncGenerator, Dict, Any, List, Optional
import asyncio
import logging
from urllib.parse import quote_plus
import httpx

from engine.core.base_provider import BaseOSINTProvider, provider_registry
from engine.core.name_intelligence import is_full_name_input, parse_full_name
from engine.models.entities import (
    EntityType,
    SeverityLevel,
    TelemetryLevel,
)

logger = logging.getLogger("iseeyou.providers.wayback_extractor")

COMMON_FREE_EMAIL_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "protonmail.com",
    "proton.me",
    "mail.com",
    "zoho.com",
    "yandex.com",
}


class WaybackMachineExtractor(BaseOSINTProvider):
    """
    Asynchronous OSINT Worker for discovering archived historical snapshots
    across public domains, developer profiles, and social identities via Archive.org.
    """

    def __init__(
        self,
        concurrency_limit: int = 6,
        request_timeout: float = 4.0,
        timeout_seconds: float = 15.0,
    ):
        super().__init__(
            name="wayback_extractor",
            display_name="Wayback Machine Historical Footprint Crawler",
            supported_types=[
                EntityType.DOMAIN,
                EntityType.SUBDOMAIN,
                EntityType.USERNAME,
                EntityType.EMAIL,
            ],
            timeout_seconds=timeout_seconds,
        )
        self.semaphore = asyncio.Semaphore(concurrency_limit)
        self.request_timeout = request_timeout

    def _build_candidate_urls(self, target: str, target_type: EntityType) -> List[str]:
        """Builds list of high-yield URLs to check against Wayback availability API."""
        clean = target.strip()
        urls: List[str] = []

        if target_type in (EntityType.DOMAIN, EntityType.SUBDOMAIN):
            clean_dom = clean.lstrip("https://").lstrip("http://").rstrip("/")
            urls.extend([
                f"https://{clean_dom}",
                f"http://{clean_dom}",
                f"https://{clean_dom}/robots.txt",
                f"https://{clean_dom}/about",
            ])

        elif target_type == EntityType.USERNAME:
            if is_full_name_input(clean):
                parsed = parse_full_name(clean)
                handles = parsed.get("candidate_handles", [])
            else:
                handles = [clean.lstrip("@").lower()]

            for h in handles[:2]:
                urls.extend([
                    f"https://github.com/{h}",
                    f"https://twitter.com/{h}",
                    f"https://instagram.com/{h}",
                    f"https://{h}.wordpress.com",
                    f"https://medium.com/@{h}",
                ])

        elif target_type == EntityType.EMAIL:
            parts = clean.split("@")
            if len(parts) == 2:
                handle, domain = parts[0].strip().lower(), parts[1].strip().lower()
                urls.extend([
                    f"https://github.com/{handle}",
                    f"https://twitter.com/{handle}",
                    f"https://medium.com/@{handle}",
                ])
                if domain not in COMMON_FREE_EMAIL_DOMAINS:
                    urls.append(f"https://{domain}")

        return urls

    async def _fetch_snapshot(
        self, client: httpx.AsyncClient, url: str
    ) -> Optional[Dict[str, Any]]:
        """Queries Archive.org Wayback Availability API for closest available snapshot."""
        encoded_url = quote_plus(url)
        api_url = f"https://archive.org/wayback/available?url={encoded_url}"

        async with self.semaphore:
            try:
                headers = {
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                    ),
                    "Accept": "application/json",
                }
                response = await client.get(
                    api_url, headers=headers, timeout=self.request_timeout
                )
                if response.status_code == 200:
                    data = response.json()
                    snapshots = data.get("archived_snapshots", {})
                    closest = snapshots.get("closest")
                    if closest and closest.get("available"):
                        return {
                            "target_url": url,
                            "snapshot_url": closest.get("url"),
                            "timestamp": closest.get("timestamp"),
                            "status": closest.get("status", "200"),
                        }
            except Exception as e:
                logger.debug(f"Wayback lookup failed for '{url}': {e}")

        return None

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Discovers archived Wayback Machine snapshots and creates history graph nodes."""
        candidate_urls = self._build_candidate_urls(target, target_type)
        if not candidate_urls:
            yield self.create_log(
                TelemetryLevel.INFO,
                f"No candidate URLs to query on Wayback Machine for {target}",
            )
            return

        yield self.create_log(
            TelemetryLevel.INFO,
            f"Querying Wayback Machine (Archive.org) for {len(candidate_urls)} candidate URLs...",
        )

        root_id = f"{target_type.value}:{target}"
        found_snapshots: List[Dict[str, Any]] = []

        async with httpx.AsyncClient() as client:
            tasks = [self._fetch_snapshot(client, u) for u in candidate_urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for res in results:
                if isinstance(res, dict) and res.get("snapshot_url"):
                    found_snapshots.append(res)

        for snap in found_snapshots:
            snap_url = snap["snapshot_url"]
            target_url = snap["target_url"]
            timestamp = snap.get("timestamp", "")
            node_id = f"wayback:{snap_url}"

            # Emit Archive Graph Node
            yield self.create_node(
                node_id=node_id,
                entity_type=EntityType.ARCHIVE,
                value=snap_url,
                label=f"Wayback: {target_url}",
                metadata={
                    "archive_service": "Wayback Machine (Archive.org)",
                    "target_url": target_url,
                    "snapshot_url": snap_url,
                    "timestamp": timestamp,
                    "http_status": snap.get("status", "200"),
                    "source": "wayback_extractor",
                },
            )

            # Emit Relationship Edge
            yield self.create_edge(
                edge_id=f"edge-{root_id}-{node_id}",
                source=root_id,
                target=node_id,
                relation="historical_snapshot",
            )

        if found_snapshots:
            yield self.create_log(
                TelemetryLevel.INFO,
                f"Discovered {len(found_snapshots)} historical Wayback snapshot(s) for '{target}'.",
            )

            severity = (
                SeverityLevel.MEDIUM if len(found_snapshots) >= 3 else SeverityLevel.LOW
            )
            evidence_str = (
                f"Found {len(found_snapshots)} snapshot(s) on Archive.org. "
                + " | ".join(f"{s['target_url']} -> {s['snapshot_url']}" for s in found_snapshots[:3])
            )
            yield self.create_finding(
                finding_id=f"vuln-wayback-{session_id}",
                node_id=root_id,
                title=f"Historical Archive Footprint Discovered ({len(found_snapshots)} Snapshot(s))",
                severity=severity,
                evidence=evidence_str,
            )
        else:
            yield self.create_log(
                TelemetryLevel.INFO,
                f"No historical snapshots found in Wayback Machine for '{target}'.",
            )


# Auto-register provider into global registry
provider_registry.register(WaybackMachineExtractor())
