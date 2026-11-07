"""
Email-to-Profile, Gravatar & OpenPGP Correlator (ISEEYOU 2.0 - Step 1.3)
Pivots from an Email Address into concrete identity leads:
1. Gravatar MD5 Profile & Avatar Lookup:
   - Extracts Display Name, Preferred Handle, Bio, Location, Linked Accounts, and Avatar URL.
2. OpenPGP / HKP Keyserver Lookup:
   - Queries public PGP keyservers for cryptographic User IDs (Real Name + Comment) and key creation dates.
3. GitHub Reverse Email Correlation (/search/users & /search/commits):
   - Resolves an email address back to the GitHub username and commit author name.
4. Custom Corporate/Campus Domain & Local-Part Handle Extraction:
   - Spawns DOMAIN and USERNAME leads for seamless lead-chaining.
"""

from typing import AsyncGenerator, Dict, Any, List, Optional, Set
from datetime import datetime, timezone
from urllib.parse import quote
import asyncio
import hashlib
import httpx
import logging
import re

from engine.core.base_provider import BaseOSINTProvider, provider_registry
from engine.models.entities import (
    EntityType,
    SeverityLevel,
    TelemetryLevel,
)

logger = logging.getLogger("iseeyou.providers.email_correlator")

CONSUMER_EMAIL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.id",
    "ymail.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "msn.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "aol.com",
    "protonmail.com",
    "proton.me",
    "pm.me",
    "zoho.com",
    "mail.com",
    "gmx.com",
    "yandex.com",
    "yandex.ru",
    "fastmail.com",
    "tutanota.com",
    "tuta.io",
}

PGP_UID_REGEX = re.compile(r"^uid:([^:]+):(\d*):[^:]*:", re.MULTILINE)


def compute_gravatar_md5(email: str) -> str:
    """Computes the lowercase trimmed MD5 hash required by Gravatar."""
    clean = email.strip().lower()
    return hashlib.md5(clean.encode("utf-8")).hexdigest()


def is_custom_org_domain(domain: str) -> bool:
    """Returns True if the email domain belongs to a custom company/campus/personal domain."""
    clean = domain.strip().lower()
    if not clean or "." not in clean:
        return False
    return clean not in CONSUMER_EMAIL_DOMAINS


class EmailCorrelatorProvider(BaseOSINTProvider):
    """
    Asynchronous Email-to-Identity Correlator.
    Turns an email address into Real Names, Avatars, Linked Social Accounts,
    PGP Keys, GitHub Handles, and Corporate/Campus Domains.
    """

    GRAVATAR_JSON_URL = "https://en.gravatar.com/{md5}.json"
    GRAVATAR_AVATAR_URL = "https://www.gravatar.com/avatar/{md5}?d=404&s=400"
    HKP_LOOKUP_URL = (
        "https://keyserver.ubuntu.com/pks/lookup?op=index&options=mr&search={email}"
    )
    GITHUB_API = "https://api.github.com"

    def __init__(self, timeout_seconds: float = 18.0):
        super().__init__(
            name="email_correlator",
            display_name="Email-to-Profile, Gravatar & PGP Correlator",
            supported_types=[EntityType.EMAIL],
            timeout_seconds=timeout_seconds,
        )

    async def _fetch_gravatar_intel(
        self, email: str, client: httpx.AsyncClient
    ) -> Optional[Dict[str, Any]]:
        """
        Queries Gravatar JSON profile API and falls back to checking if a custom avatar exists.
        """
        md5_hash = compute_gravatar_md5(email)
        try:
            resp = await client.get(
                self.GRAVATAR_JSON_URL.format(md5=md5_hash),
                timeout=6.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                entries = data.get("entry") or []
                if entries and isinstance(entries, list):
                    entry = entries[0]
                    name_obj = entry.get("name") or {}
                    full_name = (
                        name_obj.get("formatted")
                        or entry.get("displayName")
                        or None
                    )
                    accounts = []
                    for acc in entry.get("accounts") or []:
                        if isinstance(acc, dict) and acc.get("url"):
                            accounts.append(
                                {
                                    "platform": acc.get("shortname")
                                    or acc.get("domain")
                                    or "Social",
                                    "username": acc.get("username")
                                    or acc.get("display"),
                                    "url": acc.get("url"),
                                }
                            )
                    return {
                        "has_profile": True,
                        "md5": md5_hash,
                        "preferred_username": entry.get("preferredUsername"),
                        "full_name": full_name,
                        "bio": entry.get("aboutMe"),
                        "location": entry.get("currentLocation"),
                        "avatar_url": entry.get("thumbnailUrl")
                        or f"https://www.gravatar.com/avatar/{md5_hash}?s=400",
                        "profile_url": entry.get(
                            "profileUrl", f"https://gravatar.com/{md5_hash}"
                        ),
                        "accounts": accounts,
                    }

            # Fallback: Check if a custom Gravatar image exists even when JSON profile is hidden
            avatar_url = self.GRAVATAR_AVATAR_URL.format(md5=md5_hash)
            img_resp = await client.get(avatar_url, timeout=5.0)
            if img_resp.status_code == 200:
                return {
                    "has_profile": False,
                    "md5": md5_hash,
                    "preferred_username": None,
                    "full_name": None,
                    "bio": None,
                    "location": None,
                    "avatar_url": avatar_url,
                    "profile_url": f"https://gravatar.com/{md5_hash}",
                    "accounts": [],
                }
        except Exception as e:
            logger.debug(f"Gravatar lookup failed for {email}: {e}")
        return None

    async def _fetch_pgp_intel(
        self, email: str, client: httpx.AsyncClient
    ) -> Optional[Dict[str, Any]]:
        """
        Queries public HKP OpenPGP keyserver for machine-readable UID records matching the email.
        """
        try:
            url = self.HKP_LOOKUP_URL.format(email=quote(email))
            resp = await client.get(url, timeout=6.0)
            if resp.status_code != 200 or "uid:" not in resp.text:
                return None

            raw_text = resp.text
            uids: List[str] = []
            extracted_names: List[str] = []
            earliest_year: Optional[str] = None
            earliest_date: Optional[str] = None

            for match in PGP_UID_REGEX.finditer(raw_text):
                raw_uid = httpx.URL(f"http://x/{match.group(1)}").path.lstrip("/")
                created_ts_str = match.group(2)
                if raw_uid and raw_uid not in uids:
                    uids.append(raw_uid)
                    # Extract name before '<email>' or '(comment)'
                    name_part = raw_uid.split("<")[0].split("(")[0].strip()
                    if name_part and "@" not in name_part and name_part not in extracted_names:
                        extracted_names.append(name_part)

                if created_ts_str.isdigit():
                    ts = int(created_ts_str)
                    if ts > 0:
                        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                        yr = dt.strftime("%Y")
                        dt_str = dt.strftime("%Y-%m-%d")
                        if not earliest_year or yr < earliest_year:
                            earliest_year = yr
                            earliest_date = dt_str

            if not uids:
                return None

            return {
                "uids": uids[:5],
                "extracted_names": extracted_names,
                "created_year": earliest_year,
                "created_date": earliest_date,
                "keyserver_url": f"https://keyserver.ubuntu.com/pks/lookup?op=get&search={quote(email)}",
            }
        except Exception as e:
            logger.debug(f"PGP keyserver lookup failed for {email}: {e}")
        return None

    async def _fetch_github_by_email(
        self, email: str, client: httpx.AsyncClient
    ) -> Optional[Dict[str, Any]]:
        """
        Reverse-resolves an email address to a GitHub account via /search/users and /search/commits.
        """
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "ISEEYOU-OSINT-Workbench/2.0",
        }
        try:
            # 1. Try /search/users?q={email}+in:email
            u_resp = await client.get(
                f"{self.GITHUB_API}/search/users",
                params={"q": f"{email} in:email", "per_page": 3},
                headers=headers,
                timeout=6.0,
            )
            if u_resp.status_code == 200:
                items = u_resp.json().get("items") or []
                if items and isinstance(items, list):
                    top = items[0]
                    login = top.get("login")
                    if login:
                        return {
                            "login": login,
                            "avatar_url": top.get("avatar_url"),
                            "profile_url": top.get(
                                "html_url", f"https://github.com/{login}"
                            ),
                            "author_name": None,
                            "matched_via": "GitHub Public Profile Email",
                        }

            # 2. Fallback: Search public commits by author-email
            c_resp = await client.get(
                f"{self.GITHUB_API}/search/commits",
                params={"q": f"author-email:{email}", "per_page": 3},
                headers=headers,
                timeout=6.0,
            )
            if c_resp.status_code == 200:
                items = c_resp.json().get("items") or []
                if items and isinstance(items, list):
                    first = items[0]
                    author_user = first.get("author") or {}
                    commit_info = (first.get("commit") or {}).get("author") or {}
                    login = author_user.get("login")
                    author_name = commit_info.get("name")
                    if login or author_name:
                        return {
                            "login": login,
                            "avatar_url": author_user.get("avatar_url"),
                            "profile_url": author_user.get(
                                "html_url",
                                f"https://github.com/{login}" if login else "https://github.com",
                            ),
                            "author_name": author_name,
                            "matched_via": "GitHub Commit Author Search",
                        }
        except Exception as e:
            logger.debug(f"GitHub email reverse lookup failed for {email}: {e}")
        return None

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Correlates an Email Address against Gravatar, OpenPGP Keyservers, GitHub Commit Search,
        and extracts custom domain + username handle leads.
        """
        email = target.strip().lower()
        root_node_id = f"{target_type.value}:{target.strip()}"
        local_handle = email.split("@")[0] if "@" in email else email
        email_domain = email.split("@")[1] if "@" in email else ""

        yield self.create_log(
            TelemetryLevel.INFO,
            f"Correlating email '{email}' across Gravatar, OpenPGP Keyservers & GitHub Commits...",
        )

        async with self.get_http_client() as client:
            grav_res, pgp_res, gh_res = await asyncio.gather(
                self._fetch_gravatar_intel(email, client),
                self._fetch_pgp_intel(email, client),
                self._fetch_github_by_email(email, client),
                return_exceptions=True,
            )

        grav = grav_res if isinstance(grav_res, dict) else None
        pgp = pgp_res if isinstance(pgp_res, dict) else None
        gh = gh_res if isinstance(gh_res, dict) else None

        discovered_names: List[str] = []
        discovered_avatars: List[str] = []
        discovered_locations: List[str] = []
        discovered_handles: Set[str] = set()
        timeline_events: List[Dict[str, str]] = []

        # 1. Process Gravatar Intel
        if grav:
            grav_node_id = f"profile:gravatar:{grav['md5'][:10]}"
            if grav.get("full_name"):
                discovered_names.append(grav["full_name"])
            if grav.get("avatar_url"):
                discovered_avatars.append(grav["avatar_url"])
            if grav.get("location"):
                discovered_locations.append(grav["location"])
            if grav.get("preferred_username"):
                discovered_handles.add(grav["preferred_username"])

            yield self.create_node(
                node_id=grav_node_id,
                entity_type=EntityType.USERNAME,
                value=grav.get("preferred_username") or email,
                label=f"Gravatar ({grav.get('full_name') or grav.get('preferred_username') or 'Avatar Found'})",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "platform": "Gravatar",
                    "category": "Avatar & Identity",
                    "handle": grav.get("preferred_username") or local_handle,
                    "full_name": grav.get("full_name"),
                    "bio": grav.get("bio"),
                    "location": grav.get("location"),
                    "avatar_url": grav.get("avatar_url"),
                    "profile_url": grav.get("profile_url"),
                    "verified_accounts": grav.get("accounts", []),
                    "source": "Gravatar MD5 Lookup",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{grav_node_id}",
                source=root_node_id,
                target=grav_node_id,
                relation="gravatar_profile",
            )

            # Emit linked accounts found inside Gravatar profile
            for acc in grav.get("accounts", []):
                acc_platform = acc.get("platform", "Social")
                acc_user = acc.get("username") or local_handle
                acc_url = acc.get("url", "")
                acc_node_id = f"profile:{acc_platform.lower()}:{acc_user.lower()}"
                yield self.create_node(
                    node_id=acc_node_id,
                    entity_type=EntityType.USERNAME,
                    value=acc_url or acc_user,
                    label=f"{acc_platform} (@{acc_user})",
                    severity=SeverityLevel.INFO,
                    parent_id=grav_node_id,
                    metadata={
                        "platform": acc_platform,
                        "handle": acc_user,
                        "profile_url": acc_url,
                        "source": "Linked in Gravatar Profile",
                    },
                )
                yield self.create_edge(
                    edge_id=f"edge:{grav_node_id}->{acc_node_id}",
                    source=grav_node_id,
                    target=acc_node_id,
                    relation="linked_account",
                )

        # 2. Process OpenPGP Keyserver Intel
        if pgp:
            pgp_node_id = f"pgp:{email}"
            for nm in pgp.get("extracted_names", []):
                if nm not in discovered_names:
                    discovered_names.append(nm)

            if pgp.get("created_year"):
                timeline_events.append(
                    {
                        "year": pgp["created_year"],
                        "date": pgp.get("created_date", ""),
                        "event": f"Published OpenPGP Key ({pgp['uids'][0]})",
                        "platform": "OpenPGP",
                    }
                )

            yield self.create_node(
                node_id=pgp_node_id,
                entity_type=EntityType.USERNAME,
                value=pgp["uids"][0],
                label=f"🔑 PGP Key: {pgp['extracted_names'][0] if pgp.get('extracted_names') else email}",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "platform": "OpenPGP Keyserver",
                    "category": "Cryptographic Key",
                    "uids": pgp["uids"],
                    "full_name": pgp["extracted_names"][0]
                    if pgp.get("extracted_names")
                    else None,
                    "created_year": pgp.get("created_year"),
                    "profile_url": pgp.get("keyserver_url"),
                    "source": "Ubuntu HKP Keyserver",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{pgp_node_id}",
                source=root_node_id,
                target=pgp_node_id,
                relation="pgp_key_uid",
            )

        # 3. Process GitHub Reverse Email Match
        if gh:
            gh_login = gh.get("login")
            gh_author_name = gh.get("author_name")
            if gh_author_name and gh_author_name not in discovered_names:
                discovered_names.append(gh_author_name)
            if gh.get("avatar_url") and gh["avatar_url"] not in discovered_avatars:
                discovered_avatars.append(gh["avatar_url"])
            if gh_login:
                discovered_handles.add(gh_login)
                gh_node_id = f"profile:github:{gh_login.lower()}"
                yield self.create_node(
                    node_id=gh_node_id,
                    entity_type=EntityType.USERNAME,
                    value=gh_login,
                    label=f"GitHub (@{gh_login})",
                    severity=SeverityLevel.MEDIUM,
                    parent_id=root_node_id,
                    metadata={
                        "platform": "GitHub",
                        "category": "Developer",
                        "handle": gh_login,
                        "full_name": gh_author_name,
                        "avatar_url": gh.get("avatar_url"),
                        "profile_url": gh.get("profile_url"),
                        "source": gh.get("matched_via", "GitHub Email Search"),
                    },
                )
                yield self.create_edge(
                    edge_id=f"edge:{root_node_id}->{gh_node_id}",
                    source=root_node_id,
                    target=gh_node_id,
                    relation="resolved_github_account",
                )

        # 4. Emit Candidate Handle Lead Node (from email local-part)
        if local_handle and len(local_handle) >= 3:
            discovered_handles.add(local_handle)
            handle_node_id = f"username:{local_handle}"
            yield self.create_node(
                node_id=handle_node_id,
                entity_type=EntityType.USERNAME,
                value=local_handle,
                label=f"👤 Handle: {local_handle}",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "handle": local_handle,
                    "source": "Extracted from Email Prefix",
                    "lead_hint": "Click Pivot to scan this username across 16+ platforms",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{handle_node_id}",
                source=root_node_id,
                target=handle_node_id,
                relation="derived_handle",
            )

        # 5. Emit Custom Organization / Campus Domain Node if non-consumer email
        if email_domain and is_custom_org_domain(email_domain):
            dom_node_id = f"domain:{email_domain}"
            yield self.create_node(
                node_id=dom_node_id,
                entity_type=EntityType.DOMAIN,
                value=email_domain,
                label=f"🌐 {email_domain}",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "domain": email_domain,
                    "profile_url": f"https://{email_domain}",
                    "source": "Custom Email Domain",
                    "lead_hint": "Corporate, university, or personal domain linked to target email",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{dom_node_id}",
                source=root_node_id,
                target=dom_node_id,
                relation="custom_email_domain",
            )

        # Update Root Seed Node with aggregated dossier fields
        yield self.create_node(
            node_id=root_node_id,
            entity_type=EntityType.EMAIL,
            value=target.strip(),
            label=discovered_names[0] if discovered_names else target.strip(),
            severity=SeverityLevel.INFO,
            metadata={
                "role": "identity_seed",
                "emails": [email],
                "full_names": list(dict.fromkeys(discovered_names)),
                "avatars": list(dict.fromkeys(discovered_avatars)),
                "locations": list(dict.fromkeys(discovered_locations)),
                "handles": sorted(discovered_handles),
                "domains": [email_domain] if is_custom_org_domain(email_domain) else [],
                "timeline": timeline_events,
            },
        )

        if grav or pgp or gh or is_custom_org_domain(email_domain):
            evidence_parts = []
            if discovered_names:
                evidence_parts.append(f"Name: {', '.join(discovered_names)}")
            if gh and gh.get("login"):
                evidence_parts.append(f"GitHub: @{gh['login']}")
            if grav:
                evidence_parts.append("Gravatar Profile/Avatar Active")
            if pgp:
                evidence_parts.append(f"PGP Key Found ({pgp['uids'][0]})")
            if is_custom_org_domain(email_domain):
                evidence_parts.append(f"Custom Domain: {email_domain}")

            yield self.create_finding(
                finding_id=f"email-correlation:{email}",
                node_id=root_node_id,
                title=f"Email Identity Correlation for '{email}'",
                severity=SeverityLevel.MEDIUM if (gh or pgp or grav) else SeverityLevel.LOW,
                evidence=" | ".join(evidence_parts),
            )

        yield self.create_log(
            TelemetryLevel.SUCCESS,
            f"Email correlation complete for '{email}': "
            f"{len(discovered_names)} name(s), {len(discovered_avatars)} avatar(s), "
            f"{len(discovered_handles)} handle(s).",
        )


# Self-register provider
email_correlator_provider = EmailCorrelatorProvider()
provider_registry.register(email_correlator_provider)

