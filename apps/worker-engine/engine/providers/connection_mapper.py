"""
Social Connection & Mutuals Mapper (ISEEYOU 2.0 - Step 1.2)
Maps a target's inner circle (mutual followers, collaborators, and organizations) using public APIs:
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
from engine.core.name_intelligence import is_full_name_input, parse_full_name
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
                                        "role": f"Repo Co-Author ({repo_name})",
                                    }
                                )

                # Also inspect repository stargazers (peers/classmates who starred the target's project)
                star_resp = await client.get(
                    f"{self.GITHUB_API}/repos/{username}/{repo_name}/stargazers",
                    params={"per_page": 8},
                    headers=self._gh_headers(),
                    timeout=5.0,
                )
                if star_resp.status_code == 200:
                    stars = star_resp.json()
                    if isinstance(stars, list):
                        for s in stars:
                            login = (s.get("login") or "").strip()
                            if (
                                login
                                and login.lower() != username.lower()
                                and is_human_login(login)
                                and s.get("type") == "User"
                            ):
                                collaborators.append(
                                    {
                                        "login": login,
                                        "avatar_url": s.get("avatar_url"),
                                        "html_url": s.get(
                                            "html_url", f"https://github.com/{login}"
                                        ),
                                        "repo": repo_name,
                                        "contributions": 1,
                                        "role": f"Repo Stargazer / Peer ({repo_name})",
                                    }
                                )
        except Exception as e:
            logger.debug(f"Failed fetching repo collaborators for {username}: {e}")
        return collaborators

    async def _fetch_family_and_academic_circle(
        self, name_info: Dict[str, Any], client: httpx.AsyncClient
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Hunts for:
        1. Family / Clan Relatives sharing the target's surname (e.g. 'Hekopung') across
           OpenAlex, CrossRef, and GitHub Users (excluding the target's own first name).
        2. Academic Co-Authors, Thesis Supervisors (Dosen Pembimbing), and University Affiliations.
        """
        relatives_and_peers: List[Dict[str, Any]] = []
        organizations: List[Dict[str, Any]] = []

        surname = (name_info.get("surname") or "").strip()
        first_name_lower = (name_info.get("first_name") or "").strip().lower()
        formatted_name = name_info.get("formatted_name") or ""
        headers = {"User-Agent": "ISEEYOU-OSINT-Workbench/2.0 (mailto:security@iseeyou.local)"}

        # 1. Surname / Family Lineage Search on OpenAlex & GitHub Users
        if surname and len(surname) >= 4:
            try:
                oa_resp = await client.get(
                    "https://api.openalex.org/authors",
                    params={"search": surname, "per_page": 8},
                    headers=headers,
                    timeout=6.0,
                )
                if oa_resp.status_code == 200:
                    results = oa_resp.json().get("results") or []
                    for author in results:
                        disp_name = (author.get("display_name") or "").strip()
                        if not disp_name or surname.lower() not in disp_name.lower():
                            continue
                        insts = author.get("last_known_institutions") or []
                        inst_name = (
                            (insts[0].get("display_name") or "").strip() if insts else ""
                        )
                        if inst_name:
                            organizations.append(
                                {
                                    "name": inst_name,
                                    "description": f"Academic Affiliation ({disp_name})",
                                    "url": author.get("id") or f"https://openalex.org",
                                }
                            )
                        # If not the target themselves, record as Potential Family / Same-Surname Relative
                        if first_name_lower and first_name_lower not in disp_name.lower():
                            relatives_and_peers.append(
                                {
                                    "handle": disp_name,
                                    "platform": "OpenAlex / Academic Registry",
                                    "profile_url": author.get("orcid")
                                    or author.get("id")
                                    or f"https://www.google.com/search?q=%22{disp_name}%22",
                                    "relationship": f"Same Family Surname ({surname})"
                                    + (f" — {inst_name}" if inst_name else ""),
                                    "relation_edge": "family_surname_match",
                                    "confidence": 0.82,
                                }
                            )
            except Exception as e:
                logger.debug(f"OpenAlex surname search failed for '{surname}': {e}")

            # GitHub Users Search for same surname
            try:
                gh_resp = await client.get(
                    f"{self.GITHUB_API}/search/users",
                    params={"q": f'"{surname}" in:fullname', "per_page": 5},
                    headers=self._gh_headers(),
                    timeout=5.0,
                )
                if gh_resp.status_code == 200:
                    items = gh_resp.json().get("items") or []
                    for item in items:
                        login = (item.get("login") or "").strip()
                        if login and is_human_login(login):
                            relatives_and_peers.append(
                                {
                                    "handle": login,
                                    "platform": "GitHub",
                                    "avatar_url": item.get("avatar_url"),
                                    "profile_url": item.get(
                                        "html_url", f"https://github.com/{login}"
                                    ),
                                    "relationship": f"Name / Surname Match ({surname})",
                                    "relation_edge": "surname_peer",
                                    "confidence": 0.85,
                                }
                            )
            except Exception as e:
                logger.debug(f"GitHub surname search failed for '{surname}': {e}")

        # 2. CrossRef Co-Authors & Supervisors Search
        for q_name in name_info.get("name_variations", [formatted_name])[:2]:
            if not q_name:
                continue
            try:
                cr_resp = await client.get(
                    "https://api.crossref.org/works",
                    params={"query.author": q_name, "rows": 4},
                    headers=headers,
                    timeout=6.0,
                )
                if cr_resp.status_code == 200:
                    items = (cr_resp.json().get("message") or {}).get("items") or []
                    for item in items:
                        authors = item.get("author") or []
                        names_in_paper = [
                            f"{(a.get('given') or '').strip()} {(a.get('family') or '').strip()}".strip()
                            for a in authors
                        ]
                        if surname and any(surname.lower() in n.lower() for n in names_in_paper):
                            for n in names_in_paper:
                                if (
                                    n
                                    and first_name_lower not in n.lower()
                                    and n.lower() != formatted_name.lower()
                                ):
                                    relatives_and_peers.append(
                                        {
                                            "handle": n,
                                            "platform": "CrossRef Academic",
                                            "profile_url": item.get("URL")
                                            or f"https://www.google.com/search?q=%22{n}%22",
                                            "relationship": "Academic Co-Author / Supervisor",
                                            "relation_edge": "coauthor",
                                            "confidence": 0.88,
                                        }
                                    )
            except Exception as e:
                logger.debug(f"CrossRef coauthor search failed for '{q_name}': {e}")

        return {
            "relatives_and_peers": relatives_and_peers[:10],
            "organizations": organizations[:6],
        }

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Maps mutual connections, repository collaborators/stargazers, organization memberships,
        and Family Surname / Academic Co-Author networks.
        """
        raw_target = target.strip()
        full_name_mode = is_full_name_input(raw_target)
        name_info = parse_full_name(raw_target) if full_name_mode else None

        username = (
            name_info["candidate_handles"][0]
            if (full_name_mode and name_info and name_info.get("candidate_handles"))
            else self._normalize_handle(raw_target, target_type)
        )
        root_node_id = f"{target_type.value}:{raw_target}"

        if full_name_mode and name_info:
            yield self.create_log(
                TelemetryLevel.INFO,
                f"Mapping Family Clan ('{name_info['surname']}'), Academic Co-Authors & Social Circle for '{name_info['formatted_name']}' (Primary handle: '{username}')...",
            )
        else:
            yield self.create_log(
                TelemetryLevel.INFO,
                f"Mapping social connections, mutuals & collaborators for '{username}'...",
            )

        async with self.get_http_client() as client:
            if full_name_mode and name_info:
                followers, following, orgs, collaborators, fam_acad = await asyncio.gather(
                    self._fetch_followers(username, client),
                    self._fetch_following(username, client),
                    self._fetch_orgs(username, client),
                    self._fetch_repo_collaborators(username, client),
                    self._fetch_family_and_academic_circle(name_info, client),
                    return_exceptions=True,
                )
            else:
                followers, following, orgs, collaborators = await asyncio.gather(
                    self._fetch_followers(username, client),
                    self._fetch_following(username, client),
                    self._fetch_orgs(username, client),
                    self._fetch_repo_collaborators(username, client),
                    return_exceptions=True,
                )
                fam_acad = None

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
                    "relationship": col.get("role") or f"Repo Co-Author ({repo_name})",
                    "relation_edge": "repo_collaborator",
                    "confidence": 0.90,
                    "shared_repos": [repo_name] if repo_name else [],
                }

        # 3. Fallback: If no mutuals or collaborators found, include close following and followers
        if not discovered_associates:
            if 0 < len(following_map) <= 25:
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
            if 0 < len(followers_map) <= 25:
                for fl_key in list(followers_map.keys())[:5]:
                    if fl_key in discovered_associates:
                        continue
                    u_obj = followers_map[fl_key]
                    login = u_obj.get("login", fl_key)
                    discovered_associates[fl_key] = {
                        "handle": login,
                        "platform": "GitHub",
                        "avatar_url": u_obj.get("avatar_url"),
                        "profile_url": u_obj.get("html_url", f"https://github.com/{login}"),
                        "relationship": "Follower of Target",
                        "relation_edge": "followed_by",
                        "confidence": 0.65,
                        "shared_repos": [],
                    }

        # 4. Merge Family Surname Relatives & Academic Co-Authors (when Full Name mode is active)
        fam_acad_dict = fam_acad if isinstance(fam_acad, dict) else {}
        for rel in fam_acad_dict.get("relatives_and_peers", []):
            r_handle = rel.get("handle", "").strip()
            r_key = r_handle.lower()
            if r_key and r_key not in discovered_associates:
                discovered_associates[r_key] = {
                    "handle": r_handle,
                    "platform": rel.get("platform", "Public Registry"),
                    "avatar_url": rel.get("avatar_url"),
                    "profile_url": rel.get("profile_url"),
                    "relationship": rel.get("relationship", "Family / Academic Associate"),
                    "relation_edge": rel.get("relation_edge", "family_or_coauthor"),
                    "confidence": rel.get("confidence", 0.82),
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
            clean_id = handle.lower().replace(" ", "_")
            assoc_node_id = f"associate:github:{clean_id}"
            label_prefix = "👨‍👩‍👧‍👦" if "Surname" in assoc["relationship"] else "🤝"
            display_label = (
                f"{label_prefix} {handle}"
                if " " in handle
                else f"{label_prefix} @{handle}"
            )
            yield self.create_node(
                node_id=assoc_node_id,
                entity_type=EntityType.ASSOCIATE,
                value=handle,
                label=display_label,
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

        # 5. Emit Public Organization & Academic Institution Memberships
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

        for acad_org in fam_acad_dict.get("organizations", []):
            inst_name = (acad_org.get("name") or "").strip()
            if not inst_name or inst_name in discovered_org_names:
                continue
            discovered_org_names.append(inst_name)
            inst_id = f"org:{inst_name.lower().replace(' ', '_')[:36]}"
            yield self.create_node(
                node_id=inst_id,
                entity_type=EntityType.ORGANIZATION,
                value=inst_name,
                label=f"🏛️ {inst_name}",
                severity=SeverityLevel.INFO,
                parent_id=root_node_id,
                metadata={
                    "organization": inst_name,
                    "description": acad_org.get("description"),
                    "profile_url": acad_org.get("url"),
                    "source": "Academic / Clan Institution Registry",
                },
            )
            yield self.create_edge(
                edge_id=f"edge:{root_node_id}->{inst_id}",
                source=root_node_id,
                target=inst_id,
                relation="affiliated_institution",
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

