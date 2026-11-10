import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from engine.models.entities import EntityType, SeverityLevel
from engine.core.name_intelligence import is_full_name_input, parse_full_name
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

    def test_catalog_scale_and_categories(self):
        self.assertGreaterEqual(len(SOCIAL_PLATFORMS), 60)
        categories = {p["category"] for p in SOCIAL_PLATFORMS}
        self.assertIn("Developer", categories)
        self.assertIn("Social", categories)
        self.assertIn("Security", categories)
        self.assertIn("Gaming", categories)

    def test_extract_username(self):
        self.assertEqual(
            self.scanner._extract_username("john.doe@example.com", EntityType.EMAIL),
            "john.doe",
        )
        self.assertEqual(
            self.scanner._extract_username("@HackerNinja123", EntityType.USERNAME),
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
        mock_response.text = '{"login": "octocat"}'

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
        mock_response.text = "Not Found"

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

    async def test_url_probe_separation_and_metadata_extraction(self):
        platform = {
            "id": "github",
            "name": "GitHub",
            "category": "Developer",
            "url_template": "https://github.com/{username}",
            "url_probe": "https://api.github.com/users/{username}",
            "profile_url_template": "https://github.com/{username}",
            "check_type": "status_code",
            "presence_strings": ['"login":'],
            "extract": {
                "avatar_url": r'"avatar_url":\s*"([^"]+)"',
                "full_name": r'"name":\s*"([^"]+)"',
                "bio": r'"bio":\s*"([^"]+)"',
                "secondary_link": r'"blog":\s*"(https?://[^"]+)"',
            },
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = (
            '{"login": "torvalds", "name": "Linus Torvalds", '
            '"avatar_url": "https://avatars.githubusercontent.com/u/1024025", '
            '"bio": "Creator of Linux and Git", "blog": "https://kernel.org"}'
        )

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        result = await self.scanner._check_platform(platform, "torvalds", mock_client)
        self.assertIsNotNone(result)
        # Verify probe URL was requested, but public URL is returned
        called_url = mock_client.get.call_args[0][0]
        self.assertEqual(called_url, "https://api.github.com/users/torvalds")
        self.assertEqual(result["url"], "https://github.com/torvalds")
        self.assertEqual(result["full_name"], "Linus Torvalds")
        self.assertEqual(result["bio"], "Creator of Linux and Git")
        self.assertEqual(result["avatar_url"], "https://avatars.githubusercontent.com/u/1024025")
        self.assertEqual(result["secondary_link"], "https://kernel.org")

    async def test_regex_check_pre_flight_skip(self):
        platform = {
            "id": "telegram",
            "name": "Telegram",
            "category": "Messaging",
            "url_template": "https://t.me/{username}",
            "regex_check": r"^[a-zA-Z0-9_]{3,32}[^_]$",
            "check_type": "status_code",
        }
        mock_client = AsyncMock()
        # Username with invalid trailing underscore or too short should skip HTTP request
        result = await self.scanner._check_platform(platform, "ab", mock_client)
        self.assertIsNone(result)
        mock_client.get.assert_not_called()

    async def test_anti_waf_bot_challenge_rejection(self):
        platform = {
            "id": "patreon",
            "name": "Patreon",
            "category": "Creator",
            "url_template": "https://www.patreon.com/{username}",
            "check_type": "status_code",
        }
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>"

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        result = await self.scanner._check_platform(platform, "some_creator", mock_client)
        self.assertIsNone(result)

    async def test_presence_strings_verification(self):
        platform = {
            "id": "bluesky",
            "name": "Bluesky",
            "category": "Social",
            "url_template": "https://bsky.app/profile/{username}.bsky.social",
            "check_type": "message",
            "presence_strings": ['"did":'],
        }
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"status": "ok", "empty": true}'

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        # Missing '"did":' -> should return None
        result = await self.scanner._check_platform(platform, "ghost", mock_client)
        self.assertIsNone(result)

    async def test_execute_recon_username_flow(self):
        with patch.object(
            self.scanner, "_check_platform", new_callable=AsyncMock
        ) as mock_check:
            async def fake_check(platform, username, client):
                if platform["id"] in ("github", "reddit", "dockerhub", "devto"):
                    return {
                        "id": platform["id"],
                        "platform": platform["name"],
                        "category": platform["category"],
                        "url": platform["url_template"].format(username=username),
                        "full_name": "Dev Master",
                        "avatar_url": "https://example.com/avatar.png",
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
            self.assertEqual(profile_nodes[0]["metadata"]["full_name"], "Dev Master")
            self.assertEqual(profile_nodes[0]["metadata"]["engine"], "deep_footprint_v2")

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

    def test_full_name_validation_and_handle_permutation(self):
        full_name = "ALMAKIUS FELIX BARIQ HEKOPUNG"
        self.assertTrue(is_full_name_input(full_name))
        self.assertTrue(self.scanner.validate_input(full_name, EntityType.USERNAME))

        parsed = parse_full_name(full_name)
        self.assertTrue(parsed["is_full_name"])
        self.assertEqual(parsed["formatted_name"], "Almakius Felix Bariq Hekopung")
        self.assertEqual(parsed["surname"], "Hekopung")
        self.assertIn("bariqhkp", parsed["candidate_handles"])
        self.assertEqual(
            self.scanner._extract_username(full_name, EntityType.USERNAME),
            "bariqhkp",
        )

    def test_redirect_trap_detection(self):
        wp_platform = {
            "id": "wordpress",
            "name": "WordPress",
            "error_url": "wordpress.com/typo",
        }
        self.assertTrue(
            self.scanner._is_redirect_trap(
                wp_platform,
                "https://wordpress.com/typo/?subdomain=nonexistent123",
                "https://nonexistent123.wordpress.com/",
                "nonexistent123",
            )
        )
        self.assertTrue(
            self.scanner._is_redirect_trap(
                {"id": "service", "name": "Service"},
                "https://service.com/login",
                "https://service.com/user123",
                "user123",
            )
        )
        self.assertFalse(
            self.scanner._is_redirect_trap(
                {"id": "service", "name": "Service"},
                "https://service.com/user123",
                "https://service.com/user123",
                "user123",
            )
        )

    def test_soft_404_shell_detection(self):
        twitch_platform = {"id": "twitch", "name": "Twitch"}
        self.assertTrue(
            self.scanner._is_soft_404_shell(
                twitch_platform,
                "<!DOCTYPE html><html><head><title>Twitch</title></head></html>",
                "fake_channel",
            )
        )
        self.assertFalse(
            self.scanner._is_soft_404_shell(
                twitch_platform,
                "<!DOCTYPE html><html><head><title>Ninja - Twitch</title></head></html>",
                "ninja",
            )
        )

        spotify_platform = {"id": "spotify", "name": "Spotify"}
        self.assertTrue(
            self.scanner._is_soft_404_shell(
                spotify_platform,
                "<html><head><title>Page not found</title></head></html>",
                "nonexistent",
            )
        )
        self.assertTrue(
            self.scanner._is_soft_404_shell(
                spotify_platform,
                "<html><head><title>Spotify – Web Player</title></head></html>",
                "nonexistent",
            )
        )
        self.assertFalse(
            self.scanner._is_soft_404_shell(
                spotify_platform,
                '<html><head><meta property="og:type" content="profile"/></head></html>',
                "spotify",
            )
        )


if __name__ == "__main__":
    unittest.main()
