"""
Unit tests for ConnectionMapperProvider (Step 1.2).
Verifies two-way mutual follow calculation (followers ∩ following),
repository co-author extraction, bot filtering, and organization mapping.
"""

import pytest
from unittest.mock import AsyncMock, patch
from engine.providers.connection_mapper import (
    ConnectionMapperProvider,
    is_human_login,
)
from engine.models.entities import EntityType


class TestConnectionMapperHelpers:
    def test_is_human_login_filters_bots(self):
        assert is_human_login("andi_dev") is True
        assert is_human_login("dependabot[bot]") is False
        assert is_human_login("github-actions[bot]") is False
        assert is_human_login("renovate") is False
        assert is_human_login("") is False


class TestConnectionMapperExecution:
    @pytest.mark.asyncio
    async def test_execute_recon_calculates_mutuals_collaborators_and_orgs(self):
        mapper = ConnectionMapperProvider()

        fake_followers = [
            {
                "login": "reza_sec",
                "avatar_url": "https://avatars.githubusercontent.com/u/101",
                "html_url": "https://github.com/reza_sec",
            },
            {
                "login": "random_fan",
                "avatar_url": "https://avatars.githubusercontent.com/u/102",
                "html_url": "https://github.com/random_fan",
            },
        ]
        fake_following = [
            {
                "login": "reza_sec",
                "avatar_url": "https://avatars.githubusercontent.com/u/101",
                "html_url": "https://github.com/reza_sec",
            },
            {
                "login": "linus_idol",
                "avatar_url": "https://avatars.githubusercontent.com/u/103",
                "html_url": "https://github.com/linus_idol",
            },
        ]
        fake_orgs = [
            {
                "login": "indo-cyber-lab",
                "description": "Indonesian Security Research Lab",
                "avatar_url": "https://avatars.githubusercontent.com/u/500",
            }
        ]
        fake_collabs = [
            {
                "login": "dina_crypto",
                "avatar_url": "https://avatars.githubusercontent.com/u/104",
                "html_url": "https://github.com/dina_crypto",
                "repo": "osint-toolkit",
                "contributions": 14,
            }
        ]

        with patch.object(
            mapper, "_fetch_followers", new=AsyncMock(return_value=fake_followers)
        ), patch.object(
            mapper, "_fetch_following", new=AsyncMock(return_value=fake_following)
        ), patch.object(
            mapper, "_fetch_orgs", new=AsyncMock(return_value=fake_orgs)
        ), patch.object(
            mapper, "_fetch_repo_collaborators", new=AsyncMock(return_value=fake_collabs)
        ):
            events = []
            async for ev in mapper.execute_recon(
                "octo_target", EntityType.USERNAME, "sess-2"
            ):
                events.append(ev)

        nodes = [e["data"] for e in events if e["type"] == "node"]
        edges = [e["data"] for e in events if e["type"] == "edge"]
        findings = [e["data"] for e in events if e["type"] == "vuln"]

        node_ids = {n["id"] for n in nodes}

        # reza_sec is a 2-way mutual (in both followers and following)
        assert "associate:github:reza_sec" in node_ids
        # dina_crypto is a repo collaborator
        assert "associate:github:dina_crypto" in node_ids
        # random_fan and linus_idol are 1-way only, so they shouldn't pollute mutuals when real mutuals exist
        assert "associate:github:random_fan" not in node_ids
        assert "associate:github:linus_idol" not in node_ids
        # indo-cyber-lab is a public org membership
        assert "org:indo-cyber-lab" in node_ids

        mutual_node = next(n for n in nodes if n["id"] == "associate:github:reza_sec")
        assert mutual_node["type"] == "associate"
        assert "Mutual Connection" in mutual_node["metadata"]["relationship"]

        collab_node = next(n for n in nodes if n["id"] == "associate:github:dina_crypto")
        assert collab_node["type"] == "associate"
        assert "osint-toolkit" in collab_node["metadata"]["relationship"]

        assert len(edges) >= 3
        assert len(findings) == 1
        assert "@reza_sec" in findings[0]["evidence"]
        assert "indo-cyber-lab" in findings[0]["evidence"]

