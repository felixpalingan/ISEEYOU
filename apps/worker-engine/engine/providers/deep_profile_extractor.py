"""
Deep Profile & Commit Lead Extractor (ISEEYOU 2.0 - Step 1.1)
Extracts actionable OSINT leads from public developer & community APIs:
1. GitHub API (/users/{u}, /events/public, /repos/{u}/{r}/commits):
   - Full Name, Avatar URL, Bio, Location, Company/Campus, Blog URL, X/Twitter handle, Account Creation Date
   - Hidden Personal/Work Emails from git commit author metadata
2. Keybase Lookup API:
   - Full Name, Bio, Location, Avatar, and Cryptographically Verified Social/Domain Proofs
3. Reddit About JSON API:
   - Display Name, Public Bio, Karma, Account Creation Timestamp, Avatar
4. HackerNews Firebase API:
   - Bio text, Karma, Creation Date, and regex-extracted Emails/Links inside bio
"""

from typing import AsyncGenerator, Dict, Any, List, Optional, Set
from datetime import datetime, timezone
from urllib.parse import urlparse
import asyncio
import httpx
import logging
import re
import html

from engine.core.base_provider import BaseOSINTProvider, provider_registry
from engine.models.entities import (
    EntityType,
    SeverityLevel,
    TelemetryLevel,
)

logger = logging.getLogger("iseeyou.providers.deep_profile_extractor")

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
URL_REGEX = re.compile(r"https?://[^\s<>\"')]+")

IGNORED_EMAIL_PATTERNS = (
    "noreply.github.com",
    "noreply@github.com",
    "github-actions",
    "dependabot",
    "renovate",
    "example.com",
    "localhost",
)


def is_valid_lead_email(email: str) -> bool:
    """Filters out bot, noreply, and placeholder emails from commit metadata."""
    clean = email.strip().lower()
    if not clean or "@" not in clean:
        return False
    for pat in IGNORED_EMAIL_PATTERNS:
        if pat in clean:
            return False
    return True


def extract_clean_domain(raw_url: str) -> Optional[str]:
    """Extracts a clean domain name from a blog/website URL."""
    if not raw_url:
        return None
    url = raw_url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower().strip(".")
        if host and "." in host and not host.endswith((".localhost", ".local")):
            return host
    except Exception:
        pass
    return None


class DeepProfileExtractor(BaseOSINTProvider):
    """
    Asynchronous Deep Lead Extractor for Person/Identity OSINT.
    Turns a single username handle into a web of connected leads:
    Full Names, Avatars, Commit Emails, Locations, Organizations, and Personal Domains.
    """

    GITHUB_API = "https://api.github.com"
    KEYBASE_API = "https://keybase.io/_/api/1.0/user/lookup.json"
    REDDIT_ABOUT_URL = "https://www.reddit.com/user/{username}/about.json"
    HN_USER_URL = "https://hacker-news.firebaseio.com/v0/user/{username}.json"

    def __init__(self, timeout_seconds: float = 18.0):
        super().__init__(
            name="deep_profile_extractor",
            display_name="Deep Profile, Bio & Commit Email Extractor",
            supported_types=[EntityType.USERNAME, EntityType.EMAIL],
            timeout_seconds=timeout_seconds,
        )

    def _normalize_handle(self, target: str, target_type: EntityType) -> str:
        raw = target.strip()
        if target_type == EntityType.EMAIL and "@" in raw:
            return raw.split("@")[0].strip().lower()
        if raw.startswith(("http://", "https://")):
            try:
                parsed = urlparse(raw)
                parts = [
                    p
                    for p in parsed.path.split("/")
                    if p and p not in ("user", "users", "u", "id", "about.json")
                ]
                if parts:
                    return parts[-1].lstrip("@").lower()
            except Exception:
                pass
        return raw.lstrip("@").lower()

    async def _fetch_github_deep_intel(
        self, username: str, client: httpx.AsyncClient
    ) -> Optional[Dict[str, Any]]:
        """
        Queries GitHub User API + Public Events + Recent Repo Commits
        to extract identity metadata and commit author emails.
        """
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "ISEEYOU-OSINT-Workbench/2.0",
        }
        try:
            user_resp = await client.get(
                f"{self.GITHUB_API}/users/{username}",
                headers=headers,
                timeout=6.0,
            )
            if user_resp.status_code != 200:
                return None

            profile = user_resp.json()
            commit_emails: Set[str] = set()
            commit_names: Set[str] = set()

            if profile.get("email") and is_valid_lead_email(profile["email"]):
                commit_emails.add(profile["email"].strip().lower())

            # 1. Scan /events/public for PushEvent commit emails
            try:
                events_resp = await client.get(
                    f"{self.GITHUB_API}/users/{username}/events/public",
                    params={"per_page": 30},
                    headers=headers,
                    timeout=6.0,
                )
                if events_resp.status_code == 200:
                    events = events_resp.json()
                    if isinstance(events, list):
                        for ev in events:
                            if ev.get("type") == "PushEvent":
                                commits = ev.get("payload", {}).get("commits", [])
                                for c in commits:
                                    author = c.get("author") or {}
                                    email = author.get("email", "")
                                    name = author.get("name", "")
                                    if email and is_valid_lead_email(email):
                                        commit_emails.add(email.strip().lower())
                                    if name and name.lower() != username.lower():
                                        commit_names.add(name.strip())
            except Exception as e:
                logger.debug(f"GitHub events scan failed for {username}: {e}")

            # 2. Fallback: If no emails found in events, inspect latest pushed non-fork repository commits
            if not commit_emails:
                try:
                    repos_resp = await client.get(
                        f"{self.GITHUB_API}/users/{username}/repos",
                        params={"sort": "pushed", "per_page": 3, "type": "owner"},
                        headers=headers,
                        timeout=5.0,
                    )
                    if repos_resp.status_code == 200:
                        repos = repos_resp.json()
                        if isinstance(repos, list):
                            for repo in repos[:2]:
                                if repo.get("fork"):
                                    continue
                                repo_name = repo.get("name")
                                if not repo_name:
                                    continue
                                commits_resp = await client.get(
                                    f"{self.GITHUB_API}/repos/{username}/{repo_name}/commits",
                                    params={"per_page": 5},
                                    headers=headers,
                                    timeout=5.0,
                                )
                                if commits_resp.status_code == 200:
                                    commits_data = commits_resp.json()
                                    if isinstance(commits_data, list):
                                        for item in commits_data:
                                            commit_author = (
                                                item.get("commit", {}).get("author") or {}
                                            )
                                            c_email = commit_author.get("email", "")
                                            c_name = commit_author.get("name", "")
                                            if c_email and is_valid_lead_email(c_email):
                                                commit_emails.add(c_email.strip().lower())
                                            if c_name and c_name.lower() != username.lower():
                                                commit_names.add(c_name.strip())
                except Exception as e:
                    logger.debug(f"GitHub repo commit fallback failed for {username}: {e}")

            created_at = profile.get("created_at", "")
            created_year = created_at[:4] if created_at and len(created_at) >= 4 else None

            return {
                "platform": "GitHub",
                "username": profile.get("login", username),
                "full_name": profile.get("name") or (next(iter(commit_names)) if commit_names else None),
                "avatar_url": profile.get("avatar_url"),
                "bio": profile.get("bio"),
                "company": (profile.get("company") or "").strip().lstrip("@") or None,
                "location": profile.get("location"),
                "blog": profile.get("blog"),
                "twitter_username": profile.get("twitter_username"),
                "public_repos": profile.get("public_repos", 0),
                "followers": profile.get("followers", 0),
                "following": profile.get("following", 0),
                "created_at": created_at,
                "created_year": created_year,
                "commit_emails": sorted(commit_emails),
                "commit_names": sorted(commit_names),
                "profile_url": profile.get("html_url", f"https://github.com/{username}"),
            }
        except Exception as e:
            logger.debug(f"GitHub deep intel error for {username}: {e}")
            return None

    async def _fetch_keybase_intel(
        self, username: str, client: httpx.AsyncClient
    ) -> Optional[Dict[str, Any]]:
        """Queries Keybase public API for cryptographic identity & verified linked accounts."""
        try:
            resp = await client.get(
                self.KEYBASE_API,
                params={"usernames": username},
                timeout=6.0,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            them = data.get("them") or []
            if not them or not isinstance(them, list) or not them[0]:
                return None

            user_obj = them[0]
            profile = user_obj.get("profile") or {}
            pictures = user_obj.get("pictures") or {}
            primary_pic = (pictures.get("primary") or {}).get("url")
            proofs = (user_obj.get("proofs_summary") or {}).get("all") or []

            verified_accounts: List[Dict[str, str]] = []
            for p in proofs:
                p_type = p.get("proof_type") or p.get("nametag")
                nametag = p.get("nametag")
                service_url = p.get("service_url") or p.get("human_url")
                if p_type and nametag:
                    verified_accounts.append(
                        {
                            "service": str(p_type),
                            "handle": str(nametag),
                            "url": str(service_url or ""),
                        }
                    )

            return {
                "platform": "Keybase",
                "full_name": profile.get("full_name"),
                "bio": profile.get("bio"),
                "location": profile.get("location"),
                "avatar_url": primary_pic,
                "verified_accounts": verified_accounts,
                "profile_url": f"https://keybase.io/{username}",
            }
        except Exception as e:
            logger.debug(f"Keybase lookup failed for {username}: {e}")
            return None

    async def _fetch_reddit_intel(
        self, username: str, client: httpx.AsyncClient
    ) -> Optional[Dict[str, Any]]:
        """Queries Reddit public about.json for display name, bio, karma, and account creation date."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ISEEYOU-OSINT/2.0",
            "Accept": "application/json",
        }
        try:
            resp = await client.get(
                self.REDDIT_ABOUT_URL.format(username=username),
                headers=headers,
                timeout=6.0,
            )
            if resp.status_code != 200:
                return None
            payload = resp.json()
            data = payload.get("data") or {}
            if not data or data.get("is_suspended"):
                return None

            sub = data.get("subreddit") or {}
            created_utc = data.get("created_utc")
            created_date = None
            created_year = None
            if isinstance(created_utc, (int, float)) and created_utc > 0:
                dt = datetime.fromtimestamp(created_utc, tz=timezone.utc)
                created_date = dt.strftime("%Y-%m-%d")
                created_year = dt.strftime("%Y")

            raw_icon = data.get("icon_img") or sub.get("icon_img") or ""
            clean_icon = raw_icon.split("?")[0] if raw_icon else None

            return {
                "platform": "Reddit",
                "full_name": sub.get("title") or None,
                "bio": sub.get("public_description") or None,
                "total_karma": data.get("total_karma", 0),
                "created_at": created_date,
                "created_year": created_year,
                "avatar_url": clean_icon,
                "profile_url": f"https://www.reddit.com/user/{username}",
            }
        except Exception as e:
            logger.debug(f"Reddit about.json failed for {username}: {e}")
            return None

    async def _fetch_hn_intel(
        self, username: str, client: httpx.AsyncClient
    ) -> Optional[Dict[str, Any]]:
        """Queries HackerNews Firebase API for user bio, creation date, and embedded emails/links."""
        try:
            resp = await client.get(
                self.HN_USER_URL.format(username=username),
                timeout=5.0,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if not data or not isinstance(data, dict) or "id" not in data:
                return None

            raw_about = data.get("about") or ""
            clean_about = re.sub(r"<[^>]+>", " ", html.unescape(raw_about)).strip()
            created_ts = data.get("created")
            created_date = None
            created_year = None
            if isinstance(created_ts, (int, float)) and created_ts > 0:
                dt = datetime.fromtimestamp(created_ts, tz=timezone.utc)
                created_date = dt.strftime("%Y-%m-%d")
                created_year = dt.strftime("%Y")

            bio_emails = [
                e.lower()
                for e in EMAIL_REGEX.findall(clean_about)
                if is_valid_lead_email(e)
            ]
            bio_urls = URL_REGEX.findall(clean_about)

            return {
                "platform": "HackerNews",
                "bio": clean_about or None,
                "karma": data.get("karma", 0),
                "created_at": created_date,
                "created_year": created_year,
                "bio_emails": list(set(bio_emails)),
                "bio_urls": list(set(bio_urls)),
                "profile_url": f"https://news.ycombinator.com/user?id={username}",
            }
        except Exception as e:
            logger.debug(f"HackerNews lookup failed for {username}: {e}")
            return None

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes deep profile lead extraction across GitHub, Keybase, Reddit, and HackerNews.
        Emits discovered Full Names, Avatars, Bios, Commit Emails, Locations, Organizations,
        and Personal Websites as connected graph leads.
        """
        username = self._normalize_handle(target, target_type)
        root_node_id = f"{target_type.value}:{target.strip()}"

        yield self.create_log(
            TelemetryLevel.INFO,
            f"Launching Deep Profile & Commit Lead Extractor for handle '{username}'...",
        )

        async with self.get_http_client() as client:
            gh_res, kb_res, rd_res, hn_res = await asyncio.gather(
                self._fetch_github_deep_intel(username, client),
                self._fetch_keybase_intel(username, client),
                self._fetch_reddit_intel(username, client),
                self._fetch_hn_intel(username, client),
                return_exceptions=True,
            )

        gh = gh_res if isinstance(gh_res, dict) else None
        kb = kb_res if isinstance(kb_res, dict) else None
        rd = rd_res if isinstance(rd_res, dict) else None
        hn = hn_res if isinstance(hn_res, dict) else None

        discovered_emails: Set[str] = set()
        discovered_names: List[str] = []
        discovered_locations: List[str] = []
        discovered_orgs: List[str] = []
        discovered_domains: Set[str] = set()
        discovered_avatars: List[str] = []
        discovered_bios: List[Dict[str, str]] = []
        timeline_events: List[Dict[str, str]] = []

        # Aggregate from GitHub
        if gh:
            gh_node_id = f"profile:github:{username}"
            if gh.get("full_name"):
                discovered_names.append(gh["full_name"])
            if gh.get("avatar_url"):
                discovered_avatars.append(gh["avatar_url"])
            if gh.get("bio"):
                discovered_bios.append({"platform": "GitHub", "text": gh["bio"]})
            if gh.get("location"):
                discovered_locations.append(gh["location"])
            if gh.get("company"):
                discovered_orgs.append(gh["company"])
            if gh.get("created_year"):
                timeline_events.append(
                    {
                        "year": gh["created_year"],
                        "date": gh.get("created_at", "")[:10],
                        "event": f"Created GitHub account (@{username})",
                        "platform": "GitHub",
                    }
                )

            for em in gh.get("commit_emails", []):
                discovered_emails.add(em)

            if gh.get("blog"):
                dom = extract_clean_domain(gh["blog"])
                if dom:
                    discovered_domains.add(dom)

            # Emit enriched GitHub profile node
            yield self.create_node(
                node_id=gh_node_id,
                entity_type=EntityType.USERNAME,
                value=gh["profile_url"],
                label=f"GitHub: {gh.get('full_name') or username}",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "platform": "GitHub",
                    "category": "Developer",
                    "handle": username,
                    "profile_url": gh["profile_url"],
                    "full_name": gh.get("full_name"),
                    "avatar_url": gh.get("avatar_url"),
                    "bio": gh.get("bio"),
                    "location": gh.get("location"),
                    "company": gh.get("company"),
                    "blog": gh.get("blog"),
                    "twitter_username": gh.get("twitter_username"),
                    "public_repos": gh.get("public_repos"),
                    "followers": gh.get("followers"),
                    "following": gh.get("following"),
                    "created_at": gh.get("created_at"),
                    "created_year": gh.get("created_year"),
                    "commit_emails": gh.get("commit_emails", []),
                    "source": "GitHub Deep Extractor",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{gh_node_id}",
                source=root_node_id,
                target=gh_node_id,
                relation="deep_profile",
            )

            # Emit Twitter/X handle if linked on GitHub profile
            if gh.get("twitter_username"):
                tw_handle = gh["twitter_username"].lstrip("@")
                tw_node_id = f"profile:x_(twitter):{tw_handle.lower()}"
                tw_url = f"https://x.com/{tw_handle}"
                yield self.create_node(
                    node_id=tw_node_id,
                    entity_type=EntityType.USERNAME,
                    value=tw_url,
                    label=f"X (Twitter) (@{tw_handle})",
                    severity=SeverityLevel.INFO,
                    parent_id=gh_node_id,
                    metadata={
                        "platform": "X (Twitter)",
                        "category": "Social",
                        "handle": tw_handle,
                        "profile_url": tw_url,
                        "source": "Linked in GitHub Bio",
                    },
                )
                yield self.create_edge(
                    edge_id=f"edge:{gh_node_id}->{tw_node_id}",
                    source=gh_node_id,
                    target=tw_node_id,
                    relation="linked_social",
                )

        # Aggregate from Keybase
        if kb:
            kb_node_id = f"profile:keybase:{username}"
            if kb.get("full_name") and kb["full_name"] not in discovered_names:
                discovered_names.append(kb["full_name"])
            if kb.get("avatar_url") and kb["avatar_url"] not in discovered_avatars:
                discovered_avatars.append(kb["avatar_url"])
            if kb.get("bio"):
                discovered_bios.append({"platform": "Keybase", "text": kb["bio"]})
            if kb.get("location") and kb["location"] not in discovered_locations:
                discovered_locations.append(kb["location"])

            yield self.create_node(
                node_id=kb_node_id,
                entity_type=EntityType.USERNAME,
                value=kb["profile_url"],
                label=f"Keybase: {kb.get('full_name') or username}",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "platform": "Keybase",
                    "category": "Cryptographic Identity",
                    "handle": username,
                    "profile_url": kb["profile_url"],
                    "full_name": kb.get("full_name"),
                    "avatar_url": kb.get("avatar_url"),
                    "bio": kb.get("bio"),
                    "location": kb.get("location"),
                    "verified_accounts": kb.get("verified_accounts", []),
                    "source": "Keybase Proof API",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{kb_node_id}",
                source=root_node_id,
                target=kb_node_id,
                relation="cryptographic_proof",
            )

            for proof in kb.get("verified_accounts", []):
                srv = proof.get("service", "").lower()
                p_handle = proof.get("handle", "")
                if srv in ("dns", "generic_web_site") and p_handle:
                    dom = extract_clean_domain(p_handle)
                    if dom:
                        discovered_domains.add(dom)

        # Aggregate from Reddit
        if rd:
            rd_node_id = f"profile:reddit:{username}"
            if rd.get("full_name") and rd["full_name"] != username and rd["full_name"] not in discovered_names:
                discovered_names.append(rd["full_name"])
            if rd.get("avatar_url") and rd["avatar_url"] not in discovered_avatars:
                discovered_avatars.append(rd["avatar_url"])
            if rd.get("bio"):
                discovered_bios.append({"platform": "Reddit", "text": rd["bio"]})
            if rd.get("created_year"):
                timeline_events.append(
                    {
                        "year": rd["created_year"],
                        "date": rd.get("created_at", ""),
                        "event": f"Registered Reddit account (u/{username}, {rd.get('total_karma', 0)} karma)",
                        "platform": "Reddit",
                    }
                )

            yield self.create_node(
                node_id=rd_node_id,
                entity_type=EntityType.USERNAME,
                value=rd["profile_url"],
                label=f"Reddit (u/{username})",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "platform": "Reddit",
                    "category": "Community",
                    "handle": username,
                    "profile_url": rd["profile_url"],
                    "full_name": rd.get("full_name"),
                    "avatar_url": rd.get("avatar_url"),
                    "bio": rd.get("bio"),
                    "total_karma": rd.get("total_karma"),
                    "created_at": rd.get("created_at"),
                    "created_year": rd.get("created_year"),
                    "source": "Reddit About API",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{rd_node_id}",
                source=root_node_id,
                target=rd_node_id,
                relation="deep_profile",
            )

        # Aggregate from HackerNews
        if hn:
            hn_node_id = f"profile:hackernews:{username}"
            if hn.get("bio"):
                discovered_bios.append({"platform": "HackerNews", "text": hn["bio"]})
            if hn.get("created_year"):
                timeline_events.append(
                    {
                        "year": hn["created_year"],
                        "date": hn.get("created_at", ""),
                        "event": f"Joined HackerNews ({hn.get('karma', 0)} karma)",
                        "platform": "HackerNews",
                    }
                )
            for em in hn.get("bio_emails", []):
                discovered_emails.add(em)
            for u in hn.get("bio_urls", []):
                dom = extract_clean_domain(u)
                if dom:
                    discovered_domains.add(dom)

            yield self.create_node(
                node_id=hn_node_id,
                entity_type=EntityType.USERNAME,
                value=hn["profile_url"],
                label=f"HackerNews ({username})",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "platform": "HackerNews",
                    "category": "Tech Community",
                    "handle": username,
                    "profile_url": hn["profile_url"],
                    "bio": hn.get("bio"),
                    "karma": hn.get("karma"),
                    "created_at": hn.get("created_at"),
                    "created_year": hn.get("created_year"),
                    "source": "HN Firebase API",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{hn_node_id}",
                source=root_node_id,
                target=hn_node_id,
                relation="deep_profile",
            )

        # ------------------------------------------------------------------
        # Emit Chained Lead Nodes: Extracted Emails, Organizations, Locations, Domains
        # ------------------------------------------------------------------
        anchor_id = f"profile:github:{username}" if gh else root_node_id

        # 1. Extracted Commit / Bio Emails -> Spawn EMAIL Lead Nodes
        for email_addr in sorted(discovered_emails):
            email_node_id = f"email:{email_addr}"
            yield self.create_log(
                TelemetryLevel.WARN,
                f"[LEAD EXTRACTED] Discovered email address '{email_addr}' from public commit/bio metadata!",
            )
            yield self.create_node(
                node_id=email_node_id,
                entity_type=EntityType.EMAIL,
                value=email_addr,
                label=f"📧 {email_addr}",
                severity=SeverityLevel.MEDIUM,
                parent_id=anchor_id,
                metadata={
                    "source": "GitHub Commit Metadata",
                    "extracted_from": username,
                    "lead_type": "commit_email",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{anchor_id}->{email_node_id}",
                source=anchor_id,
                target=email_node_id,
                relation="leaked_commit_email",
            )

        # 2. Extracted Organizations / Campuses -> Spawn ORGANIZATION Lead Nodes
        for org in dict.fromkeys(discovered_orgs):
            org_node_id = f"org:{org.lower().replace(' ', '_')}"
            yield self.create_node(
                node_id=org_node_id,
                entity_type=EntityType.ORGANIZATION,
                value=org,
                label=f"🏢 {org}",
                severity=SeverityLevel.INFO,
                parent_id=anchor_id,
                metadata={
                    "source": "Profile Affiliation",
                    "organization": org,
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{anchor_id}->{org_node_id}",
                source=anchor_id,
                target=org_node_id,
                relation="affiliated_with",
            )

        # 3. Extracted Locations -> Spawn LOCATION Lead Nodes
        for loc in dict.fromkeys(discovered_locations):
            loc_node_id = f"loc:{loc.lower().replace(' ', '_')}"
            yield self.create_node(
                node_id=loc_node_id,
                entity_type=EntityType.LOCATION,
                value=loc,
                label=f"📍 {loc}",
                severity=SeverityLevel.INFO,
                parent_id=anchor_id,
                metadata={
                    "source": "Profile Location",
                    "location": loc,
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{anchor_id}->{loc_node_id}",
                source=anchor_id,
                target=loc_node_id,
                relation="located_in",
            )

        # 4. Extracted Personal Website / Blog Domains -> Spawn DOMAIN Lead Nodes
        for dom in sorted(discovered_domains):
            # Ignore generic social domains if accidentally put in blog field
            if any(
                dom.endswith(s)
                for s in (
                    "github.com",
                    "twitter.com",
                    "x.com",
                    "linkedin.com",
                    "instagram.com",
                    "facebook.com",
                    "youtube.com",
                    "medium.com",
                )
            ):
                continue
            dom_node_id = f"domain:{dom}"
            yield self.create_node(
                node_id=dom_node_id,
                entity_type=EntityType.DOMAIN,
                value=dom,
                label=f"🌐 {dom}",
                severity=SeverityLevel.INFO,
                parent_id=anchor_id,
                metadata={
                    "source": "Personal Website in Bio",
                    "domain": dom,
                    "profile_url": f"https://{dom}",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{anchor_id}->{dom_node_id}",
                source=anchor_id,
                target=dom_node_id,
                relation="owns_website",
            )

        # Emit enriched Root Seed Node with aggregated dossier fields
        yield self.create_node(
            node_id=root_node_id,
            entity_type=target_type,
            value=target.strip(),
            label=discovered_names[0] if discovered_names else target.strip(),
            severity=SeverityLevel.INFO,
            metadata={
                "role": "identity_seed",
                "extracted_username": username,
                "full_names": list(dict.fromkeys(discovered_names)),
                "avatars": list(dict.fromkeys(discovered_avatars)),
                "emails": sorted(discovered_emails),
                "locations": list(dict.fromkeys(discovered_locations)),
                "organizations": list(dict.fromkeys(discovered_orgs)),
                "domains": sorted(discovered_domains),
                "bios": discovered_bios,
                "timeline": sorted(timeline_events, key=lambda x: x.get("year", "9999")),
            },
        )

        # Emit Summary Finding if high-value PII leads were uncovered
        if discovered_emails or discovered_names or discovered_orgs:
            summary_parts = []
            if discovered_names:
                summary_parts.append(f"Real Name: {', '.join(dict.fromkeys(discovered_names))}")
            if discovered_emails:
                summary_parts.append(f"Commit/Bio Emails: {', '.join(sorted(discovered_emails))}")
            if discovered_orgs:
                summary_parts.append(f"Affiliation: {', '.join(dict.fromkeys(discovered_orgs))}")
            if discovered_locations:
                summary_parts.append(f"Location: {', '.join(dict.fromkeys(discovered_locations))}")

            yield self.create_finding(
                finding_id=f"deep-leads:{username}",
                node_id=anchor_id,
                title=f"Deep Identity Leads Extracted for '{username}'",
                severity=SeverityLevel.MEDIUM if discovered_emails else SeverityLevel.LOW,
                evidence=" | ".join(summary_parts),
            )

        yield self.create_log(
            TelemetryLevel.SUCCESS,
            f"Deep profile extraction complete for '{username}': "
            f"{len(discovered_names)} name(s), {len(discovered_emails)} email(s), "
            f"{len(discovered_orgs)} org(s), {len(discovered_domains)} domain(s).",
        )


# Self-register provider
deep_profile_extractor_provider = DeepProfileExtractor()
provider_registry.register(deep_profile_extractor_provider)

