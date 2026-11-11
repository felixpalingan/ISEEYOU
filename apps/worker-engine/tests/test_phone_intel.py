import unittest
from engine.models.entities import EntityType
from engine.providers.phone_intel import PhoneIntelProvider, provider_registry
from engine.api.routes import classify_input


class TestPhoneIntelProvider(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.provider = PhoneIntelProvider(timeout_seconds=5.0)

    def test_provider_metadata(self):
        self.assertEqual(self.provider.name, "phone_intel")
        self.assertTrue(self.provider.can_handle(EntityType.PHONE))
        self.assertFalse(self.provider.can_handle(EntityType.EMAIL))
        self.assertFalse(self.provider.can_handle(EntityType.DOMAIN))

    def test_registered_in_registry(self):
        registered = provider_registry.get_provider("phone_intel")
        self.assertIsNotNone(registered)
        phone_providers = provider_registry.get_providers_for_type(EntityType.PHONE)
        self.assertIn(registered, phone_providers)

    def test_classification_phone(self):
        self.assertEqual(classify_input("+6281234567890"), EntityType.PHONE)
        self.assertEqual(classify_input("081298765432"), EntityType.PHONE)
        self.assertEqual(classify_input("+1-555-234-5678"), EntityType.PHONE)
        self.assertEqual(classify_input("+65 9123 4567"), EntityType.PHONE)

    def test_normalize_indonesian_telkomsel(self):
        info = self.provider._normalize_phone("081234567890")
        self.assertEqual(info["e164"], "+6281234567890")
        self.assertEqual(info["country"], "Indonesia")
        self.assertIn("Telkomsel", info["carrier"])
        self.assertEqual(info["wa_url"], "https://wa.me/6281234567890")
        self.assertEqual(info["tg_url"], "https://t.me/+6281234567890")

    def test_normalize_indonesian_indosat(self):
        info = self.provider._normalize_phone("+6285712345678")
        self.assertEqual(info["e164"], "+6285712345678")
        self.assertEqual(info["country"], "Indonesia")
        self.assertIn("Indosat", info["carrier"])

    def test_normalize_indonesian_xl(self):
        info = self.provider._normalize_phone("087812345678")
        self.assertEqual(info["e164"], "+6287812345678")
        self.assertIn("XL Axiata", info["carrier"])

    async def test_execute_recon_emits_nodes_and_edges(self):
        events = []
        async for ev in self.provider.execute("081298765432", EntityType.PHONE, "s-phone"):
            events.append(ev)

        event_types = [e["type"] for e in events]
        self.assertIn("log", event_types)
        self.assertIn("node", event_types)
        self.assertIn("edge", event_types)
        self.assertIn("vuln", event_types)

        nodes = [e["data"] for e in events if e["type"] == "node"]
        node_values = [n["value"] for n in nodes]
        self.assertIn("+6281298765432", node_values)
        self.assertTrue(any("https://wa.me/" in v for v in node_values))
        self.assertTrue(any("https://t.me/" in v for v in node_values))

        vuln = next(e["data"] for e in events if e["type"] == "vuln")
        self.assertIn("Direct Mobile Messaging Surface", vuln["title"])


if __name__ == "__main__":
    unittest.main()

