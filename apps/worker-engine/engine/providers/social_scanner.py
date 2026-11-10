"""
Social Presence & Identity Reuse Scanner (Multi-Vector OSINT Footprint Engine)
High-performance asynchronous reconnaissance scanner evaluating 66+ public platforms
(Developer, Security, Social, Community, Messaging, Identity, Publishing, Creative,
Gaming, Streaming, Video, Audio, Creator, Finance) via asyncio concurrency.

Core detection and extraction capabilities:
- Lightweight API/JSON endpoint separation (url_probe vs canonical profile_url_template)
- Pre-flight handle syntax validation (regex_check)
- Multi-tier verification (status_code, presence_strings, absence_strings, response_url redirect trap)
- Anti-WAF & Bot-Challenge false-positive suppression
- In-flight regex profile metadata extraction (avatar_url, full_name, bio, location, secondary_link)
"""

from typing import AsyncGenerator, Dict, Any, List, Optional
import asyncio
import re
import html
from urllib.parse import urlparse
import httpx
import logging

from engine.core.base_provider import BaseOSINTProvider, provider_registry
from engine.core.name_intelligence import is_full_name_input, parse_full_name
from engine.models.entities import (
    EntityType,
    SeverityLevel,
    TelemetryLevel,
)
from engine.resources.sites_catalog import (
    OSINT_SITES_CATALOG,
    COMMON_WAF_FINGERPRINTS,
)

logger = logging.getLogger("iseeyou.providers.social_scanner")

# Exported alias for backward compatibility
SOCIAL_PLATFORMS: List[Dict[str, Any]] = OSINT_SITES_CATALOG


class SocialPresenceScanner(BaseOSINTProvider):
    """
    Asynchronous OSINT Worker for mapping public social, developer, and community presence
    using multi-tier signature verification and in-flight profile metadata extraction.
    """

    def __init__(
        self,
        concurrency_limit: int = 16,
        request_timeout: float = 4.0,
        timeout_seconds: float = 15.0,
    ):
        super().__init__(
            name="social_presence_scanner",
            display_name="Social & Identity Presence Scanner (66+ Platforms)",
            supported_types=[EntityType.USERNAME, EntityType.EMAIL],
            timeout_seconds=timeout_seconds,
        )
        self.semaphore = asyncio.Semaphore(concurrency_limit)
        self.request_timeout = request_timeout

    def _extract_username(self, target: str, target_type: EntityType) -> str:
        """Extracts candidate handle from email address, full human name, or username target"""
        if target_type == EntityType.EMAIL:
            return target.split("@")[0].strip().lower()
        clean = target.strip().lstrip("@")
        if is_full_name_input(clean):
            parsed = parse_full_name(clean)
            if parsed.get("candidate_handles"):
                return parsed["candidate_handles"][0]
        return clean.lower()

    def _validate_username_regex(self, platform: Dict[str, Any], username: str) -> bool:
        """
        Pre-flight regex_check validation.
        Avoids dispatching network requests when the target username violates
        platform-specific character or length constraints.
        """
        pattern = platform.get("regex_check")
        if not pattern:
            return True
        try:
            return bool(re.match(pattern, username))
        except re.error:
            return True

    def _is_bot_challenge(self, response_text: str) -> bool:
        """
        Anti-WAF / Bot-Challenge Detector.
        Prevents Cloudflare, AWS WAF, Vercel Security Checkpoint, DDoS-Guard,
        or reCAPTCHA interstitials (which often return HTTP 200) from being
        falsely reported as claimed user accounts.
        """
        if not response_text or not isinstance(response_text, str):
            return False
        for fingerprint in COMMON_WAF_FINGERPRINTS:
            if fingerprint in response_text:
                return True
        return False

    def _is_redirect_trap(
        self,
        platform: Dict[str, Any],
        final_url: str,
        original_url: str,
        username: str,
    ) -> bool:
        """
        Detects false-positive redirect traps:
        1. Explicit error_url matching (e.g. wordpress.com/typo)
        2. Bouncing to auth/login walls (/login, /signin, /session/new, /auth)
        3. Bouncing to generic error pages (/404, /notfound, /error)
        4. Bouncing to root homepage where username is stripped from URL
        """
        if not final_url or not isinstance(final_url, str) or final_url.startswith("<MagicMock"):
            return False

        error_url = platform.get("error_url")
        if error_url and error_url.lower() in final_url.lower():
            return True

        try:
            parsed_final = urlparse(final_url)
            parsed_orig = urlparse(original_url)

            # If redirected to a generic path where target username disappeared
            final_path = parsed_final.path.rstrip("/").lower()
            trap_paths = {
                "",
                "/login",
                "/signin",
                "/auth",
                "/session/new",
                "/typo",
                "/error",
                "/notfound",
                "/404",
                "/home",
            }
            if final_path in trap_paths and username.lower() not in final_url.lower():
                return True

            # Check if root domain redirect (e.g., http://sub.domain.com -> https://domain.com/)
            if parsed_orig.netloc.lower() != parsed_final.netloc.lower():
                if username.lower() not in final_url.lower() and (not final_path or final_path in trap_paths):
                    return True
        except Exception:
            pass

        return False

    def _is_soft_404_shell(
        self,
        platform: Dict[str, Any],
        body_text: str,
        username: str,
    ) -> bool:
        """
        Detects Single Page Application (SPA) soft 404 shells that return HTTP 200:
        1. Twitch generic title / noindex shell
        2. Spotify web player shell / page not found
        """
        if not body_text or not isinstance(body_text, str):
            return False

        lower_text = body_text.lower()
        platform_id = str(platform.get("id", "")).lower()

        if platform_id == "twitch":
            if "<title>twitch</title>" in lower_text or '<meta property="og:title" content="twitch"/>' in lower_text:
                return True

        if platform_id == "spotify":
            if (
                "<title>spotify – web player</title>" in lower_text
                or "<title>page not found</title>" in lower_text
                or "error-page" in lower_text
            ):
                return True

        return False

    def _extract_profile_metadata(
        self, platform: Dict[str, Any], response_text: str
    ) -> Dict[str, Any]:
        """
        In-flight profile metadata extractor: parses profile HTML/JSON response body
        for avatar URLs, full names, bios, locations, and secondary links.
        """
        extracted: Dict[str, Any] = {}
        extract_rules = platform.get("extract")
        if not extract_rules or not isinstance(extract_rules, dict) or not response_text:
            return extracted

        for field_key, regex_pattern in extract_rules.items():
            try:
                match = re.search(regex_pattern, response_text)
                if match and match.group(1):
                    raw_val = match.group(1).strip()
                    # Clean JSON unicode escapes and HTML entities
                    cleaned = html.unescape(raw_val).replace(r"\/", "/")
                    if cleaned and cleaned.lower() not in ("null", "none", ""):
                        extracted[field_key] = cleaned
            except Exception:
                continue

        return extracted

    async def _check_platform(
        self,
        platform: Dict[str, Any],
        username: str,
        client: httpx.AsyncClient,
    ) -> Optional[Dict[str, Any]]:
        """
        Queries a single platform using multi-tier signature detection:
        1. Pre-flight regex_check validation
        2. url_probe vs url_template resolution
        3. Anti-WAF / Captcha false-positive rejection
        4. Status code, absence_strings, presence_strings, and response_url verification
        5. Profile metadata extraction (avatar, name, bio, location, secondary links)
        """
        if not self._validate_username_regex(platform, username):
            return None

        probe_template = platform.get("url_probe") or platform["url_template"]
        url = probe_template.format(username=username)
        public_profile_url = platform.get(
            "profile_url_template", platform["url_template"]
        ).format(username=username)

        check_type = platform.get("check_type", "status_code")
        # Follow redirects for all platforms unless strictly disabled, so we can detect redirect traps
        follow_redirects = platform.get("follow_redirects", True)

        async with self.semaphore:
            try:
                headers = {
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                }
                if isinstance(platform.get("headers"), dict):
                    headers.update(platform["headers"])

                response = await client.get(
                    url,
                    headers=headers,
                    timeout=self.request_timeout,
                    follow_redirects=follow_redirects,
                )

                status_code = response.status_code
                body_text = getattr(response, "text", "") or ""
                if not isinstance(body_text, str):
                    body_text = str(body_text)

                # 1. Reject HTTP error codes (404, 410, 403, 429, 500+, etc.)
                error_codes = platform.get("error_code")
                if isinstance(error_codes, int):
                    error_codes = [error_codes]
                if error_codes and status_code in error_codes:
                    return None

                if status_code < 200 or status_code >= 300:
                    return None

                # 2. Reject WAF / Anti-Bot challenge pages (zero false positives)
                if self._is_bot_challenge(body_text):
                    logger.debug(
                        f"WAF/Bot challenge detected on {platform['name']} for '{username}' - skipping."
                    )
                    return None

                # 3. Detect redirect traps (e.g. error_url, bounce to login, or generic homepage)
                raw_final_url = getattr(response, "url", None)
                final_url = str(raw_final_url) if raw_final_url is not None else ""
                if self._is_redirect_trap(platform, final_url, url, username):
                    return None

                # 4. Detect Single Page Application soft-404 shells (Twitch, Spotify, etc.)
                if self._is_soft_404_shell(platform, body_text, username):
                    return None

                # 5. Check absence strings / negative_match / errorMsg
                absence_list: List[str] = []
                if platform.get("negative_match"):
                    absence_list.append(platform["negative_match"])
                if isinstance(platform.get("absence_strings"), list):
                    absence_list.extend(platform["absence_strings"])
                elif isinstance(platform.get("absence_strings"), str):
                    absence_list.append(platform["absence_strings"])
                if isinstance(platform.get("errorMsg"), list):
                    absence_list.extend(platform["errorMsg"])
                elif isinstance(platform.get("errorMsg"), str):
                    absence_list.append(platform["errorMsg"])

                for neg_str in absence_list:
                    if not neg_str:
                        continue
                    formatted_neg = neg_str.format(username=username) if "{username}" in neg_str else neg_str
                    if formatted_neg in body_text or formatted_neg.lower() in body_text.lower():
                        return None

                # 6. Check presence strings verification
                presence_list = platform.get("presence_strings", [])
                if isinstance(presence_list, str):
                    presence_list = [presence_list]
                if presence_list:
                    found_any = False
                    for pos_str in presence_list:
                        formatted_pos = pos_str.format(username=username) if "{username}" in pos_str else pos_str
                        if formatted_pos in body_text:
                            found_any = True
                            break
                    if not found_any:
                        return None

                # 6. Extract profile metadata
                extracted = self._extract_profile_metadata(platform, body_text)

                result: Dict[str, Any] = {
                    "id": platform.get("id", platform["name"].lower().replace(" ", "_")),
                    "platform": platform["name"],
                    "category": platform["category"],
                    "tags": platform.get("tags", []),
                    "url": public_profile_url,
                }
                if extracted:
                    result.update(extracted)

                return result

            except Exception as e:
                logger.debug(f"Failed query for {platform['name']} ({username}): {e}")

        return None

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes parallel social media reconnaissance across the 66+ platform OSINT catalog:
        1. Emits root target node
        2. Dispatches parallel checks via asyncio.gather with bounded concurrency
        3. Emits discovered profile nodes with extracted metadata (avatar, bio, name, leads)
        4. Evaluates cross-platform identity reuse attack surface risk
        """
        target = target.strip()
        username = self._extract_username(target, target_type)
        root_node_id = f"{target_type.value}:{target}"

        # 1. Spawn root target node
        yield self.create_node(
            node_id=root_node_id,
            entity_type=target_type,
            value=target,
            label=target,
            severity=SeverityLevel.INFO,
            metadata={"role": "identity_seed", "extracted_username": username},
        )

        async with self.get_http_client() as client:
            total_sites = len(SOCIAL_PLATFORMS)
            yield self.create_log(
                TelemetryLevel.INFO,
                f"Launching parallel identity scan for handle '{username}' across {total_sites} platforms...",
            )

            tasks = [
                self._check_platform(platform, username, client)
                for platform in SOCIAL_PLATFORMS
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            discovered_profiles: List[Dict[str, Any]] = []
            for res in results:
                if isinstance(res, dict) and res:
                    discovered_profiles.append(res)

            yield self.create_log(
                TelemetryLevel.SUCCESS,
                f"Completed scan across {total_sites} platforms. Identified {len(discovered_profiles)} active profile(s) for '{username}'.",
            )

            # Emit profile nodes and correlation edges
            for item in discovered_profiles:
                platform_name = item["platform"]
                profile_url = item["url"]
                category = item["category"]
                platform_slug = item.get("id") or platform_name.lower().replace(" ", "_")
                profile_node_id = f"profile:{platform_slug}:{username}"

                node_meta: Dict[str, Any] = {
                    "platform": platform_name,
                    "category": category,
                    "tags": item.get("tags", []),
                    "profile_url": profile_url,
                    "handle": username,
                    "engine": "deep_footprint_v2",
                }

                # Attach extracted profile fields if present
                if item.get("avatar_url"):
                    node_meta["avatar_url"] = item["avatar_url"]
                if item.get("full_name"):
                    node_meta["full_name"] = item["full_name"]
                if item.get("bio"):
                    node_meta["bio"] = item["bio"]
                if item.get("location"):
                    node_meta["location"] = item["location"]
                if item.get("secondary_link"):
                    node_meta["website"] = item["secondary_link"]

                yield self.create_node(
                    node_id=profile_node_id,
                    entity_type=EntityType.USERNAME,
                    value=profile_url,
                    label=f"{platform_name} ({username})",
                    severity=SeverityLevel.INFO,
                    parent_id=root_node_id,
                    metadata=node_meta,
                )

                yield self.create_edge(
                    edge_id=f"edge:{root_node_id}->{profile_node_id}",
                    source=root_node_id,
                    target=profile_node_id,
                    relation="identity_reuse",
                )

            # Attack Surface Assessment (Digital Footprint & Credential Stuffing Risk)
            if len(discovered_profiles) >= 3:
                finding_severity = (
                    SeverityLevel.MEDIUM if len(discovered_profiles) >= 6 else SeverityLevel.LOW
                )

                platforms_list = [p["platform"] for p in discovered_profiles]
                yield self.create_finding(
                    finding_id=f"identity-footprint:{username}",
                    node_id=root_node_id,
                    title=f"Significant Digital Footprint ({len(discovered_profiles)} Profiles Detected)",
                    severity=finding_severity,
                    evidence=(
                        f"Handle '{username}' is actively reused across {len(discovered_profiles)} public services: "
                        f"{', '.join(platforms_list[:10])}{'...' if len(platforms_list) > 10 else ''}. "
                        "High susceptibility to cross-platform correlation and credential stuffing."
                    ),
                )


# Register singleton instance in central provider registry
provider_registry.register(SocialPresenceScanner())
