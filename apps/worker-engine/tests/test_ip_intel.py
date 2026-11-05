import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from engine.models.entities import EntityType, SeverityLevel
from engine.providers.ip_intel import IPThreatIntelProvider, provider_registry


class TestIPThreatIntelProvider(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.provider = IPThreatIntelProvider(timeout_seconds=5.0)

    def test_provider_metadata(self):
        self.assertEqual(self.provider.name, "ip_threat_intel")
        self.assertTrue(self.provider.can_handle(EntityType.IP))
        self.assertTrue(self.provider.can_handle(EntityType.DOMAIN))
        self.assertTrue(self.provider.can_handle(EntityType.SUBDOMAIN))
        self.assertFalse(self.provider.can_handle(EntityType.EMAIL))
        self.assertFalse(self.provider.can_handle(EntityType.USERNAME))

    async def test_fetch_geolocation_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success",
            "country": "United States",
            "countryCode": "US",
            "city": "San Jose",
            "isp": "Cloudflare, Inc.",
            "as": "AS13335 Cloudflare, Inc.",
            "lat": 37.3388,
            "lon": -121.8916,
            "org": "Cloudflare",
        }

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        geo = await self.provider._fetch_geolocation("1.1.1.1", mock_client)
        self.assertEqual(geo["country"], "United States")
        self.assertEqual(geo["city"], "San Jose")
        self.assertEqual(geo["isp"], "Cloudflare, Inc.")

    async def test_fetch_shodan_internetdb_with_ports_and_vulns(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "ip": "93.184.215.14",
            "ports": [80, 443, 3306],
            "vulns": ["CVE-2021-34527"],
            "cpes": ["cpe:/a:oracle:mysql:8.0"],
            "tags": ["database"],
        }

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        shodan_data = await self.provider._fetch_shodan_internetdb(
            "93.184.215.14", mock_client
        )
        self.assertEqual(shodan_data["ports"], [80, 443, 3306])
        self.assertIn("CVE-2021-34527", shodan_data["vulns"])

    async def test_fetch_shodan_internetdb_404_clean_host(self):
        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        shodan_data = await self.provider._fetch_shodan_internetdb(
            "192.0.2.1", mock_client
        )
        self.assertEqual(shodan_data["ports"], [])
        self.assertEqual(shodan_data["vulns"], [])

    async def test_execute_recon_ip_target_flow(self):
        with patch.object(
            self.provider, "_fetch_geolocation", new_callable=AsyncMock
        ) as mock_geo, patch.object(
            self.provider, "_fetch_shodan_internetdb", new_callable=AsyncMock
        ) as mock_shodan:
            mock_geo.return_value = {
                "country": "Germany",
                "city": "Frankfurt",
                "isp": "Hetzner Online GmbH",
                "as": "AS24940 Hetzner Online GmbH",
                "lat": 50.1109,
                "lon": 8.6821,
            }
            mock_shodan.return_value = {
                "ports": [80, 3306, 6379],
                "vulns": ["CVE-2022-0001"],
                "cpes": [],
            }

            events = []
            async for event in self.provider.execute("195.201.0.1", EntityType.IP, "s-test"):
                events.append(event)

            event_types = [e["type"] for e in events]
            self.assertIn("log", event_types)
            self.assertIn("node", event_types)
            self.assertIn("edge", event_types)
            self.assertIn("vuln", event_types)
            self.assertIn("summary", event_types)

            # Verify IP Node
            ip_node = next(
                e["data"] for e in events if e["type"] == "node" and e["data"]["type"] == "ip"
            )
            self.assertEqual(ip_node["value"], "195.201.0.1")
            self.assertEqual(ip_node["metadata"]["country"], "Germany")
            self.assertEqual(ip_node["metadata"]["isp"], "Hetzner Online GmbH")

            # Verify Port Nodes
            port_nodes = [
                e["data"] for e in events if e["type"] == "node" and e["data"]["type"] == "port"
            ]
            port_values = [p["value"] for p in port_nodes]
            self.assertIn("80", port_values)
            self.assertIn("3306", port_values)
            self.assertIn("6379", port_values)

            # Verify Findings: Exposed MySQL + Exposed Redis + CVE
            vuln_findings = [e["data"] for e in events if e["type"] == "vuln"]
            self.assertTrue(any("MySQL" in v["title"] for v in vuln_findings))
            self.assertTrue(any("Redis" in v["title"] for v in vuln_findings))
            self.assertTrue(any(v.get("cve_id") == "CVE-2022-0001" for v in vuln_findings))

            # Verify summary risk score impact was recorded
            summary = next(e["data"] for e in events if e["type"] == "summary")
            self.assertGreater(summary["risk_score_impact"], 0)

    async def test_execute_recon_domain_target_flow(self):
        with patch.object(
            self.provider, "_resolve_ip_from_domain", new_callable=AsyncMock
        ) as mock_resolve, patch.object(
            self.provider, "_fetch_geolocation", new_callable=AsyncMock
        ) as mock_geo, patch.object(
            self.provider, "_fetch_shodan_internetdb", new_callable=AsyncMock
        ) as mock_shodan:
            mock_resolve.return_value = "93.184.215.14"
            mock_geo.return_value = {
                "country": "United States",
                "city": "Norwell",
                "isp": "EDGECAST",
                "as": "AS15133 MCI Communications Services",
            }
            mock_shodan.return_value = {"ports": [80, 443], "vulns": []}

            events = []
            async for event in self.provider.execute("example.com", EntityType.DOMAIN, "s-dom"):
                events.append(event)

            # Check edge connecting domain to IP
            edges = [e["data"] for e in events if e["type"] == "edge"]
            self.assertTrue(
                any(
                    e["source"] == "domain:example.com"
                    and e["target"] == "ip:93.184.215.14"
                    and e["relation"] == "hosts_infrastructure"
                    for e in edges
                )
            )

    def test_registered_in_registry(self):
        registered = provider_registry.get_provider("ip_threat_intel")
        self.assertIsNotNone(registered)
        ip_providers = provider_registry.get_providers_for_type(EntityType.IP)
        self.assertIn(registered, ip_providers)


if __name__ == "__main__":
    unittest.main()
