import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from engine.models.entities import EntityType, SeverityLevel
from engine.providers.wayback_extractor import WaybackMachineExtractor, provider_registry


class TestWaybackMachineExtractor(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.extractor = WaybackMachineExtractor(
            concurrency_limit=4,
            request_timeout=2.0,
            timeout_seconds=5.0,
        )

    def test_provider_metadata(self):
        self.assertEqual(self.extractor.name, "wayback_extractor")
        self.assertTrue(self.extractor.can_handle(EntityType.DOMAIN))
        self.assertTrue(self.extractor.can_handle(EntityType.SUBDOMAIN))
        self.assertTrue(self.extractor.can_handle(EntityType.USERNAME))
        self.assertTrue(self.extractor.can_handle(EntityType.EMAIL))
        self.assertFalse(self.extractor.can_handle(EntityType.IP))

    def test_registered_in_registry(self):
        registered = provider_registry.get_provider("wayback_extractor")
        self.assertIsNotNone(registered)
        domain_providers = provider_registry.get_providers_for_type(EntityType.DOMAIN)
        self.assertIn(registered, domain_providers)

    def test_build_candidate_urls(self):
        dom_urls = self.extractor._build_candidate_urls("example.com", EntityType.DOMAIN)
        self.assertIn("https://example.com", dom_urls)
        self.assertIn("https://example.com/robots.txt", dom_urls)

        user_urls = self.extractor._build_candidate_urls("octocat", EntityType.USERNAME)
        self.assertIn("https://github.com/octocat", user_urls)
        self.assertIn("https://twitter.com/octocat", user_urls)

        email_urls = self.extractor._build_candidate_urls("john@startup.org", EntityType.EMAIL)
        self.assertIn("https://github.com/john", email_urls)
        self.assertIn("https://startup.org", email_urls)

    async def test_fetch_snapshot_available(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "archived_snapshots": {
                "closest": {
                    "available": True,
                    "url": "http://web.archive.org/web/20261101/https://github.com/octocat",
                    "timestamp": "20261101120000",
                    "status": "200",
                }
            }
        }

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        snap = await self.extractor._fetch_snapshot(mock_client, "https://github.com/octocat")
        self.assertIsNotNone(snap)
        self.assertEqual(snap["target_url"], "https://github.com/octocat")
        self.assertEqual(snap["timestamp"], "20261101120000")

    async def test_fetch_snapshot_not_available(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"archived_snapshots": {}}

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        snap = await self.extractor._fetch_snapshot(mock_client, "https://github.com/fake")
        self.assertIsNone(snap)

    async def test_execute_recon_emits_snapshots_and_vuln(self):
        fake_snapshot = {
            "target_url": "https://example.com",
            "snapshot_url": "http://web.archive.org/web/20261101/https://example.com",
            "timestamp": "20261101120000",
            "status": "200",
        }

        with patch.object(self.extractor, "_fetch_snapshot", new=AsyncMock(return_value=fake_snapshot)):
            events = []
            async for ev in self.extractor.execute("example.com", EntityType.DOMAIN, "s-wb"):
                events.append(ev)

            event_types = [e["type"] for e in events]
            self.assertIn("log", event_types)
            self.assertIn("node", event_types)
            self.assertIn("edge", event_types)
            self.assertIn("vuln", event_types)

            node = next(e["data"] for e in events if e["type"] == "node")
            self.assertEqual(node["type"], "archive")
            self.assertIn("web.archive.org", node["value"])

            vuln = next(e["data"] for e in events if e["type"] == "vuln")
            self.assertIn("Historical Archive Footprint", vuln["title"])


if __name__ == "__main__":
    unittest.main()
