import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from typing import List, Dict, Any

from engine.models.entities import EntityType, SeverityLevel
from engine.providers.subdomain_dns import SubdomainDNSResolver, provider_registry


class TestSubdomainDNSResolver(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.resolver = SubdomainDNSResolver(
            max_subdomains_to_resolve=10,
            concurrency_limit=5,
        )

    def test_provider_metadata(self):
        self.assertEqual(self.resolver.name, "subdomain_dns_resolver")
        self.assertTrue(self.resolver.can_handle(EntityType.DOMAIN))
        self.assertTrue(self.resolver.can_handle(EntityType.SUBDOMAIN))
        self.assertFalse(self.resolver.can_handle(EntityType.IP))
        self.assertFalse(self.resolver.can_handle(EntityType.EMAIL))

    async def test_fetch_crtsh_subdomains(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {
                "name_value": "example.com\n*.sub1.example.com\nsub2.example.com",
            },
            {
                "name_value": "unrelated.org\nsub3.example.com\n*.example.com",
            },
        ]

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        subdomains = await self.resolver._fetch_crtsh_subdomains(
            "example.com", mock_client
        )

        # Wildcards stripped, unrelated filtered out, root domain excluded
        self.assertIn("sub1.example.com", subdomains)
        self.assertIn("sub2.example.com", subdomains)
        self.assertIn("sub3.example.com", subdomains)
        self.assertNotIn("unrelated.org", subdomains)
        self.assertNotIn("example.com", subdomains)

    async def test_resolve_dns_record(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "Status": 0,
            "Answer": [
                {
                    "name": "api.example.com.",
                    "type": 1,
                    "TTL": 300,
                    "data": "104.21.5.12",
                }
            ],
        }

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        answers = await self.resolver._resolve_dns_record(
            "api.example.com", "A", mock_client
        )
        self.assertEqual(len(answers), 1)
        self.assertEqual(answers[0]["data"], "104.21.5.12")

    async def test_execute_recon_with_subdomains_and_takeover(self):
        # Mock crt.sh returning subdomains
        with patch.object(
            self.resolver,
            "_fetch_crtsh_subdomains",
            new_callable=AsyncMock,
        ) as mock_crtsh, patch.object(
            self.resolver,
            "_resolve_dns_record",
            new_callable=AsyncMock,
        ) as mock_doh:
            mock_crtsh.return_value = {
                "www.example.com",
                "blog.example.com",
            }

            def fake_doh(name, record_type, client):
                if name == "example.com" and record_type == "A":
                    return [{"data": "93.184.215.14", "TTL": 300}]
                elif name == "example.com" and record_type == "MX":
                    return [{"data": "mail.example.com.", "TTL": 300}]
                elif name == "www.example.com" and record_type == "A":
                    return [{"data": "93.184.215.15", "TTL": 300}]
                elif name == "blog.example.com" and record_type == "CNAME":
                    return [{"data": "mysite.github.io.", "TTL": 300}]
                return []

            mock_doh.side_effect = fake_doh

            events = []
            async for event in self.resolver.execute("example.com", EntityType.DOMAIN, "s-1"):
                events.append(event)

            event_types = [e["type"] for e in events]
            self.assertIn("node", event_types)
            self.assertIn("edge", event_types)
            self.assertIn("vuln", event_types)

            # Check that root domain node is spawned
            root_nodes = [
                e["data"]
                for e in events
                if e["type"] == "node" and e["data"]["id"] == "domain:example.com"
            ]
            self.assertEqual(len(root_nodes), 1)

            # Check resolved IP nodes
            ip_nodes = [
                e["data"]
                for e in events
                if e["type"] == "node" and e["data"]["type"] == "ip"
            ]
            ip_values = [n["value"] for n in ip_nodes]
            self.assertIn("93.184.215.14", ip_values)
            self.assertIn("93.184.215.15", ip_values)

            # Check CNAME external dependency / takeover finding
            vuln_events = [e["data"] for e in events if e["type"] == "vuln"]
            self.assertTrue(any("GitHub Pages" in v["title"] for v in vuln_events))

    def test_registered_in_registry(self):
        registered = provider_registry.get_provider("subdomain_dns_resolver")
        self.assertIsNotNone(registered)
        domain_providers = provider_registry.get_providers_for_type(EntityType.DOMAIN)
        self.assertIn(registered, domain_providers)


if __name__ == "__main__":
    unittest.main()

