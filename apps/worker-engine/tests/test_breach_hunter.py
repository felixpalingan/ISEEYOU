import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from engine.models.entities import EntityType, SeverityLevel
from engine.providers.breach_hunter import (
    BreachCredentialHunter,
    mask_credential,
    provider_registry,
)


class TestBreachCredentialHunter(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.hunter = BreachCredentialHunter(timeout_seconds=5.0)

    def test_provider_metadata(self):
        self.assertEqual(self.hunter.name, "breach_credential_hunter")
        self.assertTrue(self.hunter.can_handle(EntityType.EMAIL))
        self.assertTrue(self.hunter.can_handle(EntityType.USERNAME))
        self.assertTrue(self.hunter.can_handle(EntityType.DOMAIN))
        self.assertFalse(self.hunter.can_handle(EntityType.IP))

    def test_mask_credential_utility(self):
        # Long password: shows first 2, last 2, stars in middle
        masked = mask_credential("password123")
        self.assertEqual(masked, "pa*******23")
        self.assertNotIn("word", masked)

        # 5-char password ("admin" -> "ad" + "**" + "n")
        masked_admin = mask_credential("admin")
        self.assertEqual(masked_admin, "ad**n")

        # 4-char password
        masked_root = mask_credential("root")
        self.assertEqual(masked_root, "r**t")

        # 2-char password
        self.assertEqual(mask_credential("ab"), "**")

        # Empty / None
        self.assertEqual(mask_credential(""), "******")

    def test_hash_sha1(self):
        digest = self.hunter._hash_sha1("password")
        self.assertEqual(len(digest), 40)
        self.assertTrue(digest.isupper())
        # Known SHA1 of "password"
        self.assertEqual(digest, "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8")

    async def test_query_k_anonymity_count_matched(self):
        # For SHA1 "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8"
        # Prefix is "5BAA6", suffix is "1E4C9B93F3F0682250B6CF8331B7EE68FD8"
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = (
            "0018A6C51D0C417A6783CFD1B7853112345:10\n"
            "1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\n"
            "FFFFA6C51D0C417A6783CFD1B7853112345:2\n"
        )

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        count = await self.hunter.query_k_anonymity_count(
            "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8", mock_client
        )
        self.assertEqual(count, 3861493)

    async def test_query_k_anonymity_count_not_found(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "0018A6C51D0C417A6783CFD1B7853112345:10\n"

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        count = await self.hunter.query_k_anonymity_count(
            "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8", mock_client
        )
        self.assertEqual(count, 0)

    async def test_execute_recon_email_target_flow(self):
        with patch.object(
            self.hunter, "query_k_anonymity_count", new_callable=AsyncMock
        ) as mock_k_anon:
            # First candidate found, others 0
            mock_k_anon.side_effect = [12000, 0, 0, 500]

            events = []
            async for event in self.hunter.execute("admin@corp.io", EntityType.EMAIL, "s-email"):
                events.append(event)

            event_types = [e["type"] for e in events]
            self.assertIn("log", event_types)
            self.assertIn("node", event_types)
            self.assertIn("edge", event_types)
            self.assertIn("vuln", event_types)
            self.assertIn("summary", event_types)

            # Check root Email node
            email_nodes = [
                e["data"] for e in events if e["type"] == "node" and e["data"]["type"] == "email"
            ]
            self.assertEqual(len(email_nodes), 1)
            self.assertEqual(email_nodes[0]["value"], "admin@corp.io")

            # Check Breach nodes
            breach_nodes = [
                e["data"] for e in events if e["type"] == "node" and e["data"]["type"] == "breach"
            ]
            self.assertGreaterEqual(len(breach_nodes), 1)

            # Check edges
            edges = [e["data"] for e in events if e["type"] == "edge"]
            self.assertTrue(any(e["relation"] == "exposed_in_breach" for e in edges))

            # Check Vulnerability Findings (Masked credentials)
            vulns = [e["data"] for e in events if e["type"] == "vuln"]
            self.assertTrue(any("Weak Credential Pattern" in v["title"] for v in vulns))
            # Verify evidence masks the password and doesn't reveal plaintext
            cred_findings = [v for v in vulns if "Weak Credential" in v["title"]]
            for f in cred_findings:
                self.assertIn("*", f["evidence"])
                self.assertNotIn("admin123", f["evidence"])

    async def test_execute_recon_domain_target_no_fake_breaches(self):
        """Verifies that scanning a domain never attaches fake historical breach dumps"""
        with patch.object(
            self.hunter, "_query_dns_txt", new_callable=AsyncMock
        ) as mock_txt:
            # Simulate domain with no SPF / DMARC records
            mock_txt.return_value = []

            events = []
            async for event in self.hunter.execute("mybrandnewwebsite.org", EntityType.DOMAIN, "s-dom"):
                events.append(event)

            # Assert ZERO fake breach nodes were emitted
            breach_nodes = [
                e["data"] for e in events if e["type"] == "node" and e["data"]["type"] == "breach"
            ]
            self.assertEqual(len(breach_nodes), 0, "Domain must not have fake breach nodes attached")

            # Assert real SPF/DMARC findings were generated instead
            vulns = [e["data"] for e in events if e["type"] == "vuln"]
            titles = [v["title"] for v in vulns]
            self.assertTrue(any("Missing SPF" in t for t in titles))
            self.assertTrue(any("Missing DMARC" in t for t in titles))

    def test_registered_in_registry(self):
        registered = provider_registry.get_provider("breach_credential_hunter")
        self.assertIsNotNone(registered)
        email_providers = provider_registry.get_providers_for_type(EntityType.EMAIL)
        self.assertIn(registered, email_providers)


if __name__ == "__main__":
    unittest.main()
