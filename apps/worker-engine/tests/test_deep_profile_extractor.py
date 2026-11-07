"""
Unit tests for DeepProfileExtractor (Step 1.1).
Verifies GitHub commit email extraction, noreply email filtering, Keybase verified proofs,
Reddit/HackerNews metadata parsing, and chained lead node emission.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from engine.providers.deep_profile_extractor import (
    DeepProfileExtractor,
    is_valid_lead_email,
    extract_clean_domain,
)
from engine.models.entities import EntityType


class TestDeepProfileExtractorHelpers:
    def test_is_valid_lead_email_filters_bots_and_noreply(self):
        assert is_valid_lead_email("target.user@gmail.com") is True
        assert is_valid_lead_email("dev@company.co.id") is True
        assert is_valid_lead_email("12345+user@users.noreply.github.com") is False
        assert is_valid_lead_email("noreply@github.com") is False
        assert is_valid_lead_email("dependabot[bot]@users.noreply.github.com") is False
        assert is_valid_lead_email("test@example.com") is False
        assert is_valid_lead_email("invalid-email") is False

    def test_extract_clean_domain(self):
        assert extract_clean_domain("https://felix-portfolio.dev/about") == "felix-portfolio.dev"
        assert extract_clean_domain("myblog.id") == "myblog.id"
        assert extract_clean_domain("http://localhost:3000") is None
        assert extract_clean_domain("") is None


class TestDeepProfileExtractorExecution:
    @pytest.mark.asyncio
    async def test_fetch_github_deep_intel_extracts_commit_emails(self):
        extractor = DeepProfileExtractor()
        mock_client = AsyncMock()

        user_resp = MagicMock()
        user_resp.status_code = 200
        user_resp.json.return_value = {
            "login": "octo_target",
            "name": "Budi Santoso",
            "avatar_url": "https://avatars.githubusercontent.com/u/999",
            "bio": "Security Researcher @CyberCorp",
            "company": "@CyberCorp",
            "location": "Jakarta, Indonesia",
            "blog": "https://budisantoso.dev",
            "twitter_username": "budi_sec",
            "public_repos": 12,
            "followers": 45,
            "following": 10,
            "created_at": "2019-04-15T10:00:00Z",
            "html_url": "https://github.com/octo_target",
        }

        events_resp = MagicMock()
        events_resp.status_code = 200
        events_resp.json.return_value = [
            {
                "type": "PushEvent",
                "payload": {
                    "commits": [
                        {
                            "author": {
                                "name": "Budi Santoso",
                                "email": "12345+octo_target@users.noreply.github.com",
                            }
                        },
                        {
                            "author": {
                                "name": "Budi Santoso",
                                "email": "budi.real@cybercorp.id",
                            }
                        },
                    ]
                },
            }
        ]

        mock_client.get.side_effect = [user_resp, events_resp]

        intel = await extractor._fetch_github_deep_intel("octo_target", mock_client)
        assert intel is not None
        assert intel["full_name"] == "Budi Santoso"
        assert intel["company"] == "CyberCorp"
        assert intel["location"] == "Jakarta, Indonesia"
        assert intel["created_year"] == "2019"
        assert intel["commit_emails"] == ["budi.real@cybercorp.id"]

    @pytest.mark.asyncio
    async def test_execute_recon_emits_chained_leads(self):
        extractor = DeepProfileExtractor()

        fake_gh = {
            "platform": "GitHub",
            "username": "octo_target",
            "full_name": "Budi Santoso",
            "avatar_url": "https://avatars.githubusercontent.com/u/999",
            "bio": "Researcher",
            "company": "CyberCorp",
            "location": "Jakarta, Indonesia",
            "blog": "https://budisantoso.dev",
            "twitter_username": "budi_sec",
            "public_repos": 12,
            "followers": 45,
            "following": 10,
            "created_at": "2019-04-15T10:00:00Z",
            "created_year": "2019",
            "commit_emails": ["budi.real@cybercorp.id"],
            "commit_names": ["Budi Santoso"],
            "profile_url": "https://github.com/octo_target",
        }
        fake_hn = {
            "platform": "HackerNews",
            "bio": "Contact me at budi.personal@gmail.com",
            "karma": 420,
            "created_at": "2018-01-10",
            "created_year": "2018",
            "bio_emails": ["budi.personal@gmail.com"],
            "bio_urls": [],
            "profile_url": "https://news.ycombinator.com/user?id=octo_target",
        }

        with patch.object(
            extractor, "_fetch_github_deep_intel", new=AsyncMock(return_value=fake_gh)
        ), patch.object(
            extractor, "_fetch_keybase_intel", new=AsyncMock(return_value=None)
        ), patch.object(
            extractor, "_fetch_reddit_intel", new=AsyncMock(return_value=None)
        ), patch.object(
            extractor, "_fetch_hn_intel", new=AsyncMock(return_value=fake_hn)
        ):
            events = []
            async for ev in extractor.execute_recon(
                "octo_target", EntityType.USERNAME, "sess-1"
            ):
                events.append(ev)

        nodes = [e["data"] for e in events if e["type"] == "node"]
        findings = [e["data"] for e in events if e["type"] == "vuln"]

        node_ids = {n["id"] for n in nodes}
        assert "profile:github:octo_target" in node_ids
        assert "profile:x_(twitter):budi_sec" in node_ids
        assert "email:budi.real@cybercorp.id" in node_ids
        assert "email:budi.personal@gmail.com" in node_ids
        assert "org:cybercorp" in node_ids
        assert "loc:jakarta,_indonesia" in node_ids
        assert "domain:budisantoso.dev" in node_ids

        # Root seed node should carry aggregated dossier & chronological timeline
        root_node = next(n for n in nodes if n["id"] == "username:octo_target")
        assert "Budi Santoso" in root_node["metadata"]["full_names"]
        assert "budi.real@cybercorp.id" in root_node["metadata"]["emails"]
        assert len(root_node["metadata"]["timeline"]) == 2
        assert root_node["metadata"]["timeline"][0]["year"] == "2018"

        assert len(findings) == 1
        assert "budi.real@cybercorp.id" in findings[0]["evidence"]
