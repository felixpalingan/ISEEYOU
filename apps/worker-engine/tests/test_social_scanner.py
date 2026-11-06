import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from engine.models.entities import EntityType, SeverityLevel
from engine.providers.social_scanner import (
    SocialPresenceScanner,
    SOCIAL_PLATFORMS,
    provider_registry,
)


class TestSocialPresenceScanner(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.scanner = SocialPresenceScanner(
            concurrency_limit=5,
            request_timeout=2.0,
            timeout_seconds=5.0,
        )

    def test_provider_metadata(self):
        self.assertEqual(self.scanner.name, "social_presence_scanner")
        self.assertTrue(self.scanner.can_handle(EntityType.USERNAME))
        self.assertTrue(self.scanner.can_handle(EntityType.EMAIL))
        self.assertFalse(self.scanner.can_handle(EntityType.DOMAIN))
        self.assertFalse(self.scanner.can_handle(EntityType.IP))

    def test_extract_username(self):
        self.assertEqual(
            self.scanner._extract_username("john.doe@example.com", EntityType.EMAIL),
            "john.doe",
        )
        self.assertEqual(
            self.scanner._extract_username("HackerNinja123", EntityType.USERNAME),
            "hackerninja123",
        )

    async def test_check_platform_status_code_match(self):
        platform = {
            "name": "GitHub",
            "category": "Developer",
            "url_template": "https://github.com/{username}",
            "check_type": "status_code",
        }

        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        result = await self.scanner._check_platform(platform, "octocat", mock_client)
        self.assertIsNotNone(result)
        self.assertEqual(result["platform"], "GitHub")
        self.assertEqual(result["url"], "https://github.com/octocat")

    async def test_check_platform_status_code_not_found(self):
        platform = {
            "name": "GitHub",
            "category": "Developer",
            "url_template": "https://github.com/{username}",
            "check_type": "status_code",
        }

        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        result = await self.scanner._check_platform(platform, "non_existent_12345", mock_client)
        self.assertIsNone(result)

    async def test_check_platform_body_text_negative_match(self):
        platform = {
            "name": "Steam",
            "category": "Gaming",
            "url_template": "https://steamcommunity.com/id/{username}",
            "check_type": "body_text",
            "negative_match": "The specified profile could not be found",
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "Error: The specified profile could not be found."

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        result = await self.scanner._check_platform(platform, "ghost_user", mock_client)
        self.assertIsNone(result)

    async def test_execute_recon_username_flow(self):
        with patch.object(
            self.scanner, "_check_platform", new_callable=AsyncMock
        ) as mock_check:
            # Simulate 4 positive matches out of 25
            async def fake_check(platform, username, client):
                if platform["id"] in ("github", "reddit", "dockerhub", "devto"):
                    return {
                        "platform": platform["name"],
                        "category": platform["category"],
                        "url": platform["url_template"].format(username=username),
                    }
                return None

            mock_check.side_effect = fake_check

            events = []
            async for event in self.scanner.execute("dev_master", EntityType.USERNAME, "s-soc"):
                events.append(event)

            event_types = [e["type"] for e in events]
            self.assertIn("log", event_types)
            self.assertIn("node", event_types)
            self.assertIn("edge", event_types)
            self.assertIn("vuln", event_types)
            self.assertIn("summary", event_types)

            # Check root node
            root_node = next(
                e["data"] for e in events if e["type"] == "node" and e["data"]["type"] == "username"
            )
            self.assertEqual(root_node["value"], "dev_master")

            # Check profile nodes
            profile_nodes = [
                e["data"] for e in events if e["type"] == "node" and "profile:" in e["data"]["id"]
            ]
            self.assertEqual(len(profile_nodes), 4)

            # Check correlation edges
            edges = [e["data"] for e in events if e["type"] == "edge"]
            self.assertEqual(len(edges), 4)
            self.assertTrue(all(e["relation"] == "identity_reuse" for e in edges))

            # Check digital footprint vulnerability finding (>= 3 matches)
            vulns = [e["data"] for e in events if e["type"] == "vuln"]
            self.assertEqual(len(vulns), 1)
            self.assertIn("Digital Footprint", vulns[0]["title"])

    def test_registered_in_registry(self):
        registered = provider_registry.get_provider("social_presence_scanner")
        self.assertIsNotNone(registered)
        user_providers = provider_registry.get_providers_for_type(EntityType.USERNAME)
        self.assertIn(registered, user_providers)


if __name__ == "__main__":
    unittest.main()
