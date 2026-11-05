import unittest
from typing import AsyncGenerator, Dict, Any, List
import httpx

from engine.models.entities import (
    EntityType,
    SeverityLevel,
    VulnerabilityFinding,
)
from engine.core.base_provider import (
    BaseOSINTProvider,
    ProviderRegistry,
    provider_registry,
)


class MockSuccessProvider(BaseOSINTProvider):
    def __init__(self):
        super().__init__(
            name="mock_success",
            display_name="Mock Success Provider",
            supported_types=[EntityType.DOMAIN, EntityType.IP],
        )

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        yield self.create_log("info", f"Executing mock recon on {target}")

        node = self.create_node(
            node_id=f"node-{target}",
            entity_type=target_type,
            value=target,
            severity=SeverityLevel.INFO,
        )
        yield node

        edge = self.create_edge(
            edge_id=f"edge-{target}",
            source="root",
            target=f"node-{target}",
            relation="discovered",
        )
        yield edge

        vuln = self.create_finding(
            finding_id=f"vuln-{target}",
            node_id=f"node-{target}",
            title="Exposed Test Service",
            severity=SeverityLevel.HIGH,
            evidence="Port 80 open without TLS",
        )
        yield vuln


class MockFailingProvider(BaseOSINTProvider):
    def __init__(self):
        super().__init__(
            name="mock_failing",
            display_name="Mock Failing Provider",
            supported_types=[EntityType.DOMAIN],
        )

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        yield self.create_log("info", "Starting failing call...")
        raise httpx.ConnectTimeout("Connection timed out to upstream API")


class TestBaseOSINTProvider(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.provider = MockSuccessProvider()
        self.failing_provider = MockFailingProvider()

    def test_can_handle(self):
        self.assertTrue(self.provider.can_handle(EntityType.DOMAIN))
        self.assertTrue(self.provider.can_handle(EntityType.IP))
        self.assertFalse(self.provider.can_handle(EntityType.EMAIL))
        self.assertFalse(self.provider.can_handle(EntityType.USERNAME))

    def test_validate_input_domain(self):
        self.assertTrue(self.provider.validate_input("example.com", EntityType.DOMAIN))
        self.assertTrue(
            self.provider.validate_input("sub.api.example.org", EntityType.DOMAIN)
        )
        self.assertFalse(
            self.provider.validate_input("not a domain", EntityType.DOMAIN)
        )
        self.assertFalse(
            self.provider.validate_input("http://example.com", EntityType.DOMAIN)
        )

    def test_validate_input_ip(self):
        self.assertTrue(self.provider.validate_input("1.1.1.1", EntityType.IP))
        self.assertTrue(self.provider.validate_input("192.168.1.100", EntityType.IP))
        self.assertFalse(self.provider.validate_input("999.999.999.999", EntityType.IP))
        self.assertFalse(self.provider.validate_input("not-an-ip", EntityType.IP))

    def test_calculate_risk(self):
        # Empty findings -> 0
        self.assertEqual(self.provider.calculate_risk([]), 0)

        # Single findings
        self.assertEqual(
            self.provider.calculate_risk([SeverityLevel.LOW]),
            5,
        )
        self.assertEqual(
            self.provider.calculate_risk([SeverityLevel.MEDIUM]),
            10,
        )
        self.assertEqual(
            self.provider.calculate_risk([SeverityLevel.HIGH]),
            20,
        )
        self.assertEqual(
            self.provider.calculate_risk([SeverityLevel.CRITICAL]),
            35,
        )

        # Combined findings: Critical (35) + High (20) = 55
        findings = [
            VulnerabilityFinding(
                id="v1",
                node_id="n1",
                title="Critical Vuln",
                severity=SeverityLevel.CRITICAL,
                evidence="RCE",
            ),
            VulnerabilityFinding(
                id="v2",
                node_id="n1",
                title="High Vuln",
                severity=SeverityLevel.HIGH,
                evidence="SQLi",
            ),
        ]
        self.assertEqual(self.provider.calculate_risk(findings), 55)

        # Capped at 100: 3x Critical = 105 -> 100
        critical_overflow = [SeverityLevel.CRITICAL] * 3
        self.assertEqual(self.provider.calculate_risk(critical_overflow), 100)

    async def test_execute_lifecycle_success(self):
        events = []
        async for event in self.provider.execute("example.com", EntityType.DOMAIN, "sess-123"):
            events.append(event)

        # Check emitted event sequence
        event_types = [e["type"] for e in events]
        self.assertIn("log", event_types)
        self.assertIn("node", event_types)
        self.assertIn("edge", event_types)
        self.assertIn("vuln", event_types)
        self.assertIn("summary", event_types)

        # Verify summary content
        summary_event = next(e for e in events if e["type"] == "summary")
        summary_data = summary_event["data"]
        self.assertEqual(summary_data["provider_name"], "mock_success")
        self.assertEqual(summary_data["nodes_discovered"], 1)
        self.assertEqual(summary_data["edges_discovered"], 1)
        self.assertEqual(summary_data["vulnerabilities_found"], 1)
        self.assertEqual(summary_data["risk_score_impact"], 20)  # HIGH = 20
        self.assertEqual(summary_data["status"], "completed")

    async def test_execute_validation_failure(self):
        events = []
        async for event in self.provider.execute("invalid domain!", EntityType.DOMAIN, "sess-123"):
            events.append(event)

        event_types = [e["type"] for e in events]
        self.assertIn("summary", event_types)
        summary_event = next(e for e in events if e["type"] == "summary")
        self.assertEqual(summary_event["data"]["status"], "invalid_input")
        self.assertNotIn("node", event_types)

    async def test_execute_graceful_exception_handling(self):
        events = []
        # Failing provider should not raise unhandled exception
        async for event in self.failing_provider.execute("example.com", EntityType.DOMAIN, "sess-123"):
            events.append(event)

        event_types = [e["type"] for e in events]
        self.assertIn("log", event_types)
        self.assertIn("summary", event_types)

        summary_event = next(e for e in events if e["type"] == "summary")
        self.assertEqual(summary_event["data"]["provider_name"], "mock_failing")


class TestProviderRegistry(unittest.TestCase):
    def setUp(self):
        self.registry = ProviderRegistry()
        self.provider1 = MockSuccessProvider()
        self.provider2 = MockFailingProvider()

    def test_registry_operations(self):
        self.registry.register(self.provider1)
        self.registry.register(self.provider2)

        # Lookup by name
        self.assertEqual(self.registry.get_provider("mock_success"), self.provider1)
        self.assertEqual(self.registry.get_provider("mock_failing"), self.provider2)
        self.assertIsNone(self.registry.get_provider("unknown"))

        # Lookup by type
        domain_providers = self.registry.get_providers_for_type(EntityType.DOMAIN)
        self.assertEqual(len(domain_providers), 2)

        ip_providers = self.registry.get_providers_for_type(EntityType.IP)
        self.assertEqual(len(ip_providers), 1)
        self.assertEqual(ip_providers[0].name, "mock_success")

        email_providers = self.registry.get_providers_for_type(EntityType.EMAIL)
        self.assertEqual(len(email_providers), 0)

        # Unregister & Clear
        self.registry.unregister("mock_success")
        self.assertIsNone(self.registry.get_provider("mock_success"))
        self.registry.clear()
        self.assertEqual(len(self.registry.get_all()), 0)


if __name__ == "__main__":
    unittest.main()

