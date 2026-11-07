"""
Social Connection & Mutuals Mapper (ISEEYOU 2.0 - Step 1.2)
Maps a target's inner circle ("Dia kenal siapa aja / satu circle sama siapa") using public APIs:
1. Mutual Follow Intersection (followers ∩ following):
   - Identifies real-world friends, peers, and colleagues where both accounts follow each other.
2. Repository Co-Authors & Contributors:
   - Identifies collaborators who have committed code to the target's repositories.
3. Public Organization Memberships (/users/{u}/orgs):
   - Identifies companies, teams, university labs, or communities the target belongs to.
"""

from typing import AsyncGenerator, Dict, Any, List, Optional
from urllib.parse import urlparse
import asyncio
import httpx
import logging

from engine.core.base_provider import BaseOSINTProvider, provider_registry
from engine.models.entities import (
    EntityType,
    SeverityLevel,
    TelemetryLevel,
)

logger = logging.getLogger("iseeyou.providers.connection_mapper")

IGNORED_BOT_LOGINS = (
    "dependabot",
    "dependabot[bot]",
    "github-actions",
    "github-actions[bot]",
    "renovate",
    "renovate[bot]",
    "codecov",
    "snyk-bot",
)


def is_human_login(login: str) -> bool:
    """Filters out automated bot accounts from collaborator/connection lists."""
    clean = login.strip().lower()
    if not clean or clean.endswith("[bot]"):
        return False
    return clean not in IGNORED_BOT_LOGINS


class ConnectionMapperProvider(BaseOSINTProvider):
    """
    Asynchronous Social Graph & Mutual Connections Mapper.
    Uncovers who the target knows, collaborates with, and belongs to.
    """

    GITHUB_API = "https://api.github.com"
    MAX_ASSOCIATE_NODES = 12

    def __init__(self, timeout_seconds: float = 18.0):
        super().__init__(
            name="connection_mapper",
            display_name="Social Circle, Mutuals & Collaborator Mapper",
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
                    if p and p not in ("user", "users", "u", "id")
                ]
                if parts:
                    return parts[-1].lstrip("@").lower()
            except Exception:
                pass
        return raw.lstrip("@").lower()

    def _gh_headers(self) -> Dict[str, str]:
        return {
            "Accept": "application/vnd.github+json",
            "User-Agent": "ISEEYOU-OSINT-Workbench/2.0",
        }

    async def _fetch_followers(
        self, username: str, client: httpx.AsyncClient
    ) -> List[Dict[str, Any]]:
        try:
            resp = await client.get(
                f"{self.GITHUB_API}/users/{username}/followers",
                params={"per_page": 100},
                headers=self._gh_headers(),
                timeout=6.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data
        except Exception as e:
            logger.debug(f"Failed fetching followers for {username}: {e}")
        return []

    async def _fetch_following(
        self, username: str, client: httpx.AsyncClient
    ) -> List[Dict[str, Any]]:
        try:
            resp = await client.get(
                f"{self.GITHUB_API}/users/{username}/following",
                params={"per_page": 100},
                headers=self._gh_headers(),
                timeout=6.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data
        except Exception as e:
            logger.debug(f"Failed fetching following for {username}: {e}")
        return []

    async def _fetch_orgs(
        self, username: str, client: httpx.AsyncClient
    ) -> List[Dict[str, Any]]:
        try:
            resp = await client.get(
                f"{self.GITHUB_API}/users/{username}/orgs",
                params={"per_page": 50},
                headers=self._gh_headers(),
                timeout=6.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data
        except Exception as e:
            logger.debug(f"Failed fetching orgs for {username}: {e}")
        return []

    async def _fetch_repo_collaborators(
        self, username: str, client: httpx.AsyncClient
    ) -> List[Dict[str, Any]]:
        """
        Inspects the target's top non-fork repositories to find frequent co-authors/contributors.
        """
        collaborators: List[Dict[str, Any]] = []
        try:
            repos_resp = await client.get(
                f"{self.GITHUB_API}/users/{username}/repos",
                params={"sort": "pushed", "per_page": 4, "type": "owner"},
                headers=self._gh_headers(),
                timeout=5.0,
            )
            if repos_resp.status_code != 200:
                return []
            repos = repos_resp.json()
            if not isinstance(repos, list):
                return []

            non_fork_repos = [
                r for r in repos if isinstance(r, dict) and not r.get("fork") and r.get("name")
            ][:2]

            for repo in non_fork_repos:
                repo_name = repo["name"]
                contrib_resp = await client.get(
                    f"{self.GITHUB_API}/repos/{username}/{repo_name}/contributors",
                    params={"per_page": 10},
                    headers=self._gh_headers(),
                    timeout=5.0,
                )
                if contrib_resp.status_code == 200:
                    contribs = contrib_resp.json()
                    if isinstance(contribs, list):
                        for c in contribs:
                            login = (c.get("login") or "").strip()
                            if (
                                login
                                and login.lower() != username.lower()
                                and is_human_login(login)
                                and c.get("type") == "User"
                            ):
                                collaborators.append(
                                    {
                                        "login": login,
                                        "avatar_url": c.get("avatar_url"),
                                        "html_url": c.get(
                                            "html_url", f"https://github.com/{login}"
                                        ),
                                        "repo": repo_name,
                                        "contributions": c.get("contributions", 1),
                                    }
                                )
        except Exception as e:
            logger.debug(f"Failed fetching repo collaborators for {username}: {e}")
        return collaborators

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Maps mutual connections, repository collaborators, and organization memberships
        to uncover the target's social & professional network.
        """
        username = self._normalize_handle(target, target_type)
        root_node_id = f"{target_type.value}:{target.strip()}"

        yield self.create_log(
            TelemetryLevel.INFO,
            f"Mapping social connections, mutuals & collaborators for '{username}'...",
        )

        async with self.get_http_client() as client:
            followers, following, orgs, collaborators = await asyncio.gather(
                self._fetch_followers(username, client),
                self._fetch_following(username, client),
                self._fetch_orgs(username, client),
                self._fetch_repo_collaborators(username, client),
                return_exceptions=True,
            )

        followers_list = followers if isinstance(followers, list) else []
        following_list = following if isinstance(following, list) else []
        orgs_list = orgs if isinstance(orgs, list) else []
        collabs_list = collaborators if isinstance(collaborators, list) else []

        # Map by lowercase login
        followers_map: Dict[str, Dict[str, Any]] = {}
        for u in followers_list:
            login = (u.get("login") or "").strip()
            if login and is_human_login(login):
                followers_map[login.lower()] = u

        following_map: Dict[str, Dict[str, Any]] = {}
        for u in following_list:
            login = (u.get("login") or "").strip()
            if login and is_human_login(login):
                following_map[login.lower()] = u

        # 1. Calculate Two-Way Mutuals (followers ∩ following)
        mutual_keys = sorted(set(followers_map.keys()) & set(following_map.keys()))

        discovered_associates: Dict[str, Dict[str, Any]] = {}

        for m_key in mutual_keys:
            u_obj = following_map[m_key]
            login = u_obj.get("login", m_key)
            discovered_associates[m_key] = {
                "handle": login,
                "platform": "GitHub",
                "avatar_url": u_obj.get("avatar_url"),
                "profile_url": u_obj.get("html_url", f"https://github.com/{login}"),
                "relationship": "Mutual Connection (2-Way Follow)",
                "relation_edge": "mutual_connection",
                "confidence": 0.95,
                "shared_repos": [],
            }

        # 2. Merge Repository Co-Authors / Collaborators
        for col in collabs_list:
            login = col["login"]
            c_key = login.lower()
            repo_name = col.get("repo")
            if c_key in discovered_associates:
                if repo_name and repo_name not in discovered_associates[c_key]["shared_repos"]:
                    discovered_associates[c_key]["shared_repos"].append(repo_name)
                discovered_associates[c_key]["relationship"] = (
                    f"Mutual & Repo Co-Author ({repo_name})"
                )
                discovered_associates[c_key]["confidence"] = 0.98
            else:
                discovered_associates[c_key] = {
                    "handle": login,
                    "platform": "GitHub",
                    "avatar_url": col.get("avatar_url"),
                    "profile_url": col.get("html_url", f"https://github.com/{login}"),
                    "relationship": f"Repo Co-Author ({repo_name})",
                    "relation_edge": "repo_collaborator",
                    "confidence": 0.90,
                    "shared_repos": [repo_name] if repo_name else [],
                }

        # 3. Fallback: If no mutuals or collaborators found, but target follows a tight circle (<= 20 accounts)
        if not discovered_associates and 0 < len(following_map) <= 20:
            for f_key in list(following_map.keys())[:5]:
                u_obj = following_map[f_key]
                login = u_obj.get("login", f_key)
                discovered_associates[f_key] = {
                    "handle": login,
                    "platform": "GitHub",
                    "avatar_url": u_obj.get("avatar_url"),
                    "profile_url": u_obj.get("html_url", f"https://github.com/{login}"),
                    "relationship": "Followed by Target",
                    "relation_edge": "follows",
                    "confidence": 0.65,
                    "shared_repos": [],
                }

        # Emit Associate Nodes (capped to MAX_ASSOCIATE_NODES to keep graph clean)
        sorted_associates = sorted(
            discovered_associates.values(),
            key=lambda x: x["confidence"],
            reverse=True,
        )[: self.MAX_ASSOCIATE_NODES]

        for assoc in sorted_associates:
            handle = assoc["handle"]
            assoc_node_id = f"associate:github:{handle.lower()}"
            yield self.create_node(
                node_id=assoc_node_id,
                entity_type=EntityType.ASSOCIATE,
                value=handle,
                label=f"🤝 @{handle}",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "handle": handle,
                    "platform": assoc["platform"],
                    "category": "Associate / Inner Circle",
                    "avatar_url": assoc.get("avatar_url"),
                    "profile_url": assoc.get("profile_url"),
                    "relationship": assoc["relationship"],
                    "shared_repos": assoc.get("shared_repos", []),
                    "confidence_score": assoc["confidence"],
                    "source": "Social Connection Mapper",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{assoc_node_id}",
                source=root_node_id,
                target=assoc_node_id,
                relation=assoc["relation_edge"],
                confidence=assoc["confidence"],
            )

        # 4. Emit Public Organization Memberships
        discovered_org_names: List[str] = []
        for org_obj in orgs_list[:8]:
            org_login = (org_obj.get("login") or "").strip()
            if not org_login:
                continue
            discovered_org_names.append(org_login)
            org_node_id = f"org:{org_login.lower()}"
            org_url = f"https://github.com/{org_login}"
            yield self.create_node(
                node_id=org_node_id,
                entity_type=EntityType.ORGANIZATION,
                value=org_login,
                label=f"🏢 @{org_login}",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "organization": org_login,
                    "description": org_obj.get("description"),
                    "avatar_url": org_obj.get("avatar_url"),
                    "profile_url": org_url,
                    "source": "GitHub Organization Membership",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{org_node_id}",
                source=root_node_id,
                target=org_node_id,
                relation="member_of",
            )

        # Update Root Seed Node with discovered associates & organizations
        if sorted_associates or discovered_org_names:
            yield self.create_node(
                node_id=root_node_id,
                entity_type=target_type,
                value=target.strip(),
                label=target.strip(),
                severity=SeverityLevel.INFO,
                metadata={
                    "role": "identity_seed",
                    "associates": [
                        {
                            "handle": a["handle"],
                            "relationship": a["relationship"],
                            "avatar_url": a.get("avatar_url"),
                            "profile_url": a.get("profile_url"),
                        }
                        for a in sorted_associates
                    ],
                    "organizations": discovered_org_names,
                },
            )

            summary_parts = []
            if sorted_associates:
                handles_preview = ", ".join(f"@{a['handle']}" for a in sorted_associates[:5])
                summary_parts.append(
                    f"{len(sorted_associates)} close associate(s) ({handles_preview})"
                )
            if discovered_org_names:
                summary_parts.append(
                    f"Organizations: {', '.join(discovered_org_names)}"
                )

            yield self.create_finding(
                finding_id=f"social-circle:{username}",
                node_id=root_node_id,
                title=f"Mapped Inner Circle & Connections for '{username}'",
                severity=SeverityLevel.LOW,
                evidence=" | ".join(summary_parts),
            )

        yield self.create_log(
            TelemetryLevel.SUCCESS,
            f"Connection mapping complete for '{username}': "
            f"{len(mutual_keys)} mutual(s), {len(sorted_associates)} associate node(s), "
            f"{len(discovered_org_names)} organization(s).",
        )


# Self-register provider
connection_mapper_provider = ConnectionMapperProvider()
provider_registry.register(connection_mapper_provider)

