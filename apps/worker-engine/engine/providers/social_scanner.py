"""
Social Presence & Identity Reuse Scanner (Task 1.5)
High-performance asynchronous reconnaissance scanner evaluating 25 major
public platforms (Developer, Social, Gaming, Community) via asyncio concurrency.
"""

from typing import AsyncGenerator, Dict, Any, List, Optional
import asyncio
import httpx
import logging

from engine.core.base_provider import BaseOSINTProvider, provider_registry
from engine.models.entities import (
    EntityType,
    SeverityLevel,
    TelemetryLevel,
)

logger = logging.getLogger("iseeyou.providers.social_scanner")

# Standard 25 top public platforms directory
SOCIAL_PLATFORMS: List[Dict[str, Any]] = [
    {
        "id": "github",
        "name": "GitHub",
        "category": "Developer",
        "url_template": "https://github.com/{username}",
        "check_type": "status_code",
    },
    {
        "id": "gitlab",
        "name": "GitLab",
        "category": "Developer",
        "url_template": "https://gitlab.com/{username}",
        "check_type": "status_code",
    },
    {
        "id": "reddit",
        "name": "Reddit",
        "category": "Community",
        "url_template": "https://www.reddit.com/user/{username}/about.json",
        "check_type": "status_code",
    },
    {
        "id": "twitter",
        "name": "X (Twitter)",
        "category": "Social",
        "url_template": "https://x.com/{username}",
        "check_type": "status_code",
    },
    {
        "id": "telegram",
        "name": "Telegram",
        "category": "Messaging",
        "url_template": "https://t.me/{username}",
        "check_type": "body_text",
        "negative_match": "If you have Telegram, you can contact",
    },
    {
        "id": "steam",
        "name": "Steam Community",
        "category": "Gaming",
        "url_template": "https://steamcommunity.com/id/{username}",
        "check_type": "body_text",
        "negative_match": "The specified profile could not be found",
    },
    {
        "id": "dockerhub",
        "name": "DockerHub",
        "category": "Developer",
        "url_template": "https://hub.docker.com/v2/users/{username}",
        "check_type": "status_code",
    },
    {
        "id": "pypi",
        "name": "PyPI",
        "category": "Developer",
        "url_template": "https://pypi.org/user/{username}/",
        "check_type": "status_code",
    },
    {
        "id": "medium",
        "name": "Medium",
        "category": "Publishing",
        "url_template": "https://medium.com/@{username}",
        "check_type": "status_code",
    },
    {
        "id": "pinterest",
        "name": "Pinterest",
        "category": "Creative",
        "url_template": "https://www.pinterest.com/{username}/",
        "check_type": "status_code",
    },
    {
        "id": "spotify",
        "name": "Spotify",
        "category": "Music",
        "url_template": "https://open.spotify.com/user/{username}",
        "check_type": "status_code",
    },
    {
        "id": "devto",
        "name": "Dev.to",
        "category": "Developer",
        "url_template": "https://dev.to/{username}",
        "check_type": "status_code",
    },
    {
        "id": "hackernews",
        "name": "HackerNews",
        "category": "Tech",
        "url_template": "https://news.ycombinator.com/user?id={username}",
        "check_type": "body_text",
        "negative_match": "No such user.",
    },
    {
        "id": "pastebin",
        "name": "Pastebin",
        "category": "Developer",
        "url_template": "https://pastebin.com/u/{username}",
        "check_type": "status_code",
    },
    {
        "id": "twitch",
        "name": "Twitch",
        "category": "Streaming",
        "url_template": "https://m.twitch.tv/{username}",
        "check_type": "status_code",
    },
    {
        "id": "vimeo",
        "name": "Vimeo",
        "category": "Video",
        "url_template": "https://vimeo.com/{username}",
        "check_type": "status_code",
    },
    {
        "id": "soundcloud",
        "name": "SoundCloud",
        "category": "Audio",
        "url_template": "https://soundcloud.com/{username}",
        "check_type": "status_code",
    },
    {
        "id": "disqus",
        "name": "Disqus",
        "category": "Community",
        "url_template": "https://disqus.com/by/{username}/",
        "check_type": "status_code",
    },
    {
        "id": "keybase",
        "name": "Keybase",
        "category": "Identity",
        "url_template": "https://keybase.io/{username}",
        "check_type": "status_code",
    },
    {
        "id": "replit",
        "name": "Replit",
        "category": "Developer",
        "url_template": "https://replit.com/@{username}",
        "check_type": "status_code",
    },
    {
        "id": "aboutme",
        "name": "About.me",
        "category": "Identity",
        "url_template": "https://about.me/{username}",
        "check_type": "status_code",
    },
    {
        "id": "producthunt",
        "name": "ProductHunt",
        "category": "Tech",
        "url_template": "https://www.producthunt.com/@{username}",
        "check_type": "status_code",
    },
    {
        "id": "buymeacoffee",
        "name": "BuyMeACoffee",
        "category": "Creator",
        "url_template": "https://www.buymeacoffee.com/{username}",
        "check_type": "status_code",
    },
    {
        "id": "chess",
        "name": "Chess.com",
        "category": "Gaming",
        "url_template": "https://api.chess.com/pub/player/{username}",
        "check_type": "status_code",
    },
    {
        "id": "gravatar",
        "name": "Gravatar",
        "category": "Identity",
        "url_template": "https://en.gravatar.com/{username}.json",
        "check_type": "status_code",
    },
]


class SocialPresenceScanner(BaseOSINTProvider):
    """
    Asynchronous OSINT Worker for mapping public social and developer presence.
    Dispatches parallel checks across 25 platforms with bounded concurrency.
    """

    def __init__(
        self,
        concurrency_limit: int = 12,
        request_timeout: float = 4.0,
        timeout_seconds: float = 12.0,
    ):
        super().__init__(
            name="social_presence_scanner",
            display_name="Social & Identity Presence Scanner",
            supported_types=[EntityType.USERNAME, EntityType.EMAIL],
            timeout_seconds=timeout_seconds,
        )
        self.semaphore = asyncio.Semaphore(concurrency_limit)
        self.request_timeout = request_timeout

    def _extract_username(self, target: str, target_type: EntityType) -> str:
        """Extracts candidate handle from email address or username target"""
        if target_type == EntityType.EMAIL:
            return target.split("@")[0].strip().lower()
        return target.strip().lower()

    async def _check_platform(
        self,
        platform: Dict[str, Any],
        username: str,
        client: httpx.AsyncClient,
    ) -> Optional[Dict[str, Any]]:
        """
        Queries a single platform URL with concurrency control and error tolerance
        """
        url = platform["url_template"].format(username=username)

        async with self.semaphore:
            try:
                # Common realistic browser headers to prevent basic bot challenge blocks
                headers = {
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                }

                response = await client.get(
                    url,
                    headers=headers,
                    timeout=self.request_timeout,
                    follow_redirects=True,
                )

                if response.status_code == 200:
                    check_type = platform.get("check_type", "status_code")
                    if check_type == "status_code":
                        return {
                            "platform": platform["name"],
                            "category": platform["category"],
                            "url": url,
                        }
                    elif check_type == "body_text":
                        neg = platform.get("negative_match")
                        if neg and neg not in response.text:
                            return {
                                "platform": platform["name"],
                                "category": platform["category"],
                                "url": url,
                            }
            except Exception as e:
                logger.debug(f"Failed query for {platform['name']} ({username}): {e}")

        return None

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes parallel social media reconnaissance across 25 platforms:
        1. Emits root target node
        2. Dispatches parallel checks via asyncio.gather
        3. Emits discovered profile nodes and identity correlation edges
        4. Evaluates username reuse attack surface risk
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
            yield self.create_log(
                TelemetryLevel.INFO,
                f"Launching parallel identity presence scan for handle '{username}' across 25 platforms...",
            )

            # Build parallel tasks
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
                f"Completed social scan. Identified {len(discovered_profiles)} active profile(s) for '{username}'.",
            )

            # Emit profile nodes and correlation edges
            for item in discovered_profiles:
                platform_name = item["platform"]
                profile_url = item["url"]
                category = item["category"]
                profile_node_id = f"profile:{platform_name.lower().replace(' ', '_')}:{username}"

                yield self.create_node(
                    node_id=profile_node_id,
                    entity_type=EntityType.USERNAME,
                    value=profile_url,
                    label=f"{platform_name} ({username})",
                    severity=SeverityLevel.INFO,
                    parent_id=root_node_id,
                    metadata={
                        "platform": platform_name,
                        "category": category,
                        "profile_url": profile_url,
                    },
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
                        f"{', '.join(platforms_list[:8])}{'...' if len(platforms_list) > 8 else ''}. "
                        "High susceptibility to cross-platform correlation and credential stuffing."
                    ),
                )


# Register singleton instance in central provider registry
provider_registry.register(SocialPresenceScanner())

