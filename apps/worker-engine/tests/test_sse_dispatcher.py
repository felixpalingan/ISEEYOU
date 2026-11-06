import unittest
import asyncio
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from engine.main import app
from engine.core.event_bus import EventBus, event_bus
from engine.core.base_provider import provider_registry


class TestEventBus(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.bus = EventBus(max_history_per_session=50)

    def tearDown(self):
        self.bus.clear_all()

    async def test_publish_and_subscribe(self):
        queue = self.bus.subscribe("session-1")
        await self.bus.publish("session-1", "log", {"message": "Test log event"})

        event = await queue.get()
        self.assertEqual(event["event"], "log")
        self.assertEqual(event["data"]["message"], "Test log event")
        self.assertIn("timestamp", event)

        self.bus.unsubscribe("session-1", queue)

    async def test_late_subscriber_history_replay(self):
        # 1. Publish 2 events before subscriber arrives
        await self.bus.publish("session-2", "node", {"id": "node-1", "type": "domain"})
        await self.bus.publish("session-2", "log", {"message": "Started scan"})

        # 2. Late subscriber connects
        late_queue = self.bus.subscribe("session-2")

        # 3. Should immediately yield the 2 historical events in order
        event1 = await late_queue.get()
        self.assertEqual(event1["event"], "node")
        self.assertEqual(event1["data"]["id"], "node-1")

        event2 = await late_queue.get()
        self.assertEqual(event2["event"], "log")
        self.assertEqual(event2["data"]["message"], "Started scan")

        self.bus.unsubscribe("session-2", late_queue)

    async def test_task_registration_and_cancellation(self):
        async def mock_long_task():
            await asyncio.sleep(10)

        task = asyncio.create_task(mock_long_task())
        self.bus.register_task("session-3", task)

        self.assertFalse(task.done())
        cancelled = self.bus.cancel_task("session-3")
        self.assertTrue(cancelled)

        await asyncio.sleep(0.01)
        self.assertTrue(task.cancelled())


class TestAPIRoutes(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check_endpoint(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertGreaterEqual(data["active_modules_count"], 4)

        module_names = [m["name"] for m in data["modules"]]
        self.assertIn("subdomain_dns_resolver", module_names)
        self.assertIn("ip_threat_intel", module_names)
        self.assertIn("breach_credential_hunter", module_names)
        self.assertIn("social_presence_scanner", module_names)

    def test_create_scan_and_query_status(self):
        # 1. Create scan session
        response = self.client.post("/api/v1/scan", json={"seed_input": "example.com"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("session_id", data)
        self.assertEqual(data["seed_input"], "example.com")
        self.assertEqual(data["seed_type"], "domain")
        self.assertEqual(data["status"], "running")

        session_id = data["session_id"]

        # 2. Query status
        status_resp = self.client.get(f"/api/v1/scan/{session_id}")
        self.assertEqual(status_resp.status_code, 200)
        status_data = status_resp.json()
        self.assertEqual(status_data["session_id"], session_id)

        # 3. Cancel scan
        cancel_resp = self.client.post(f"/api/v1/scan/{session_id}/cancel")
        self.assertEqual(cancel_resp.status_code, 200)

    def test_get_nonexistent_scan_404(self):
        response = self.client.get("/api/v1/scan/non-existent-uuid")
        self.assertEqual(response.status_code, 404)

    def test_create_scan_with_enabled_modules(self):
        response = self.client.post(
            "/api/v1/scan",
            json={
                "seed_input": "example.com",
                "enabled_modules": ["subdomain_dns_resolver"],
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["seed_input"], "example.com")
        self.assertEqual(data["seed_type"], "domain")
        self.client.post(f"/api/v1/scan/{data['session_id']}/cancel")


if __name__ == "__main__":
    unittest.main()

