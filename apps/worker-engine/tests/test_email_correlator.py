"""
Unit tests for EmailCorrelatorProvider (Step 1.3).
Verifies Gravatar MD5 hashing & profile correlation, OpenPGP HKP UID extraction,
GitHub reverse email lookup, and custom corporate/campus domain extraction.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from engine.providers.email_correlator import (
    EmailCorrelatorProvider,
    compute_gravatar_md5,
    is_custom_org_domain,
)
from engine.models.entities import EntityType


class TestEmailCorrelatorHelpers:
    def test_compute_gravatar_md5(self):
        # Standard lowercase + strip MD5 check
        assert (
            compute_gravatar_md5("  MyEmailAddress@example.com ")
            == "0bc83cb571cd1c50ba6f3e8a78ef1346"
        )

    def test_is_custom_org_domain(self):
        assert is_custom_org_domain("cybercorp.co.id") is True
        assert is_custom_org_domain("cs.ui.ac.id") is True
        assert is_custom_org_domain("gmail.com") is False
        assert is_custom_org_domain("proton.me") is False
        assert is_custom_org_domain("yahoo.com") is False


class TestEmailCorrelatorExecution:
    @pytest.mark.asyncio
    async def test_fetch_pgp_intel_parses_machine_readable_hkp(self):
        correlator = EmailCorrelatorProvider()
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = (
            "info:1:1\n"
            "pub:ABCDEF1234567890:1:4096:1609459200::\n"
            "uid:Budi Santoso (Security Key) <budi@cybercorp.id>:1609459200::\n"
        )
        mock_client.get.return_value = mock_resp

        intel = await correlator._fetch_pgp_intel("budi@cybercorp.id", mock_client)
        assert intel is not None
        assert "Budi Santoso" in intel["extracted_names"]
        assert intel["created_year"] == "2021"

    @pytest.mark.asyncio
    async def test_execute_recon_emits_gravatar_pgp_github_and_domain_leads(self):
        correlator = EmailCorrelatorProvider()

        fake_grav = {
            "has_profile": True,
            "md5": "0bc83cb571cd1c50ba6f3e8a78ef1346",
            "preferred_username": "budi_grav",
            "full_name": "Budi Santoso",
            "bio": "OSINT Researcher",
            "location": "Bandung",
            "avatar_url": "https://www.gravatar.com/avatar/0bc83cb?s=400",
            "profile_url": "https://gravatar.com/budi_grav",
            "accounts": [
                {
                    "platform": "Mastodon",
                    "username": "budi_masto",
                    "url": "https://infosec.exchange/@budi_masto",
                }
            ],
        }
        fake_pgp = {
            "uids": ["Budi Santoso <budi@cybercorp.id>"],
            "extracted_names": ["Budi Santoso"],
            "created_year": "2020",
            "created_date": "2020-05-01",
            "keyserver_url": "https://keyserver.ubuntu.com/pks/lookup?op=get&search=budi%40cybercorp.id",
        }
        fake_gh = {
            "login": "budi_gh",
            "avatar_url": "https://avatars.githubusercontent.com/u/777",
            "profile_url": "https://github.com/budi_gh",
            "author_name": "Budi Santoso",
            "matched_via": "GitHub Commit Author Search",
        }

        with patch.object(
            correlator, "_fetch_gravatar_intel", new=AsyncMock(return_value=fake_grav)
        ), patch.object(
            correlator, "_fetch_pgp_intel", new=AsyncMock(return_value=fake_pgp)
        ), patch.object(
            correlator, "_fetch_github_by_email", new=AsyncMock(return_value=fake_gh)
        ):
            events = []
            async for ev in correlator.execute_recon(
                "budi@cybercorp.id", EntityType.EMAIL, "sess-3"
            ):
                events.append(ev)

        nodes = [e["data"] for e in events if e["type"] == "node"]
        findings = [e["data"] for e in events if e["type"] == "vuln"]

        node_ids = {n["id"] for n in nodes}
        assert "profile:gravatar:0bc83cb571" in node_ids
        assert "profile:mastodon:budi_masto" in node_ids
        assert "pgp:budi@cybercorp.id" in node_ids
        assert "profile:github:budi_gh" in node_ids
        assert "username:budi" in node_ids
        assert "domain:cybercorp.id" in node_ids

        assert len(findings) == 1
        assert "@budi_gh" in findings[0]["evidence"]
        assert "cybercorp.id" in findings[0]["evidence"]

