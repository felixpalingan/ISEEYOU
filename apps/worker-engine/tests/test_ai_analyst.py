import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from engine.main import app
from engine.services.ai_analyst import AIReconAnalystService
from engine.models.entities import (
    AIAnalysisRequest,
    EntityType,
    EntityNode,
    SeverityLevel,
    VulnerabilityFinding,
)


class TestAIReconAnalyst(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.service = AIReconAnalystService(api_key="")
        self.client = TestClient(app)

        self.mock_nodes = [
            EntityNode(
                id="node-1",
                type=EntityType.DOMAIN,
                value="target-corp.com",
                label="Target Corp",
                severity=SeverityLevel.HIGH,
                metadata={},
            ),
            EntityNode(
                id="node-2",
                type=EntityType.PORT,
                value="3306",
                label="MySQL (3306)",
                severity=SeverityLevel.CRITICAL,
                metadata={"service": "mysql"},
            ),
            EntityNode(
                id="node-3",
                type=EntityType.EMAIL,
                value="admin@target-corp.com",
                label="admin@target-corp.com",
                severity=SeverityLevel.HIGH,
                metadata={"breach_count": 5},
            ),
        ]

        self.mock_findings = [
            VulnerabilityFinding(
                id="vuln-1",
                node_id="node-2",
                title="Exposed Database Port (MySQL 3306)",
                severity=SeverityLevel.CRITICAL,
                cve_id="CWE-200",
                evidence="Port 3306 open to 0.0.0.0/0",
            ),
            VulnerabilityFinding(
                id="vuln-2",
                node_id="node-3",
                title="Compromised Corporate Credentials Found",
                severity=SeverityLevel.HIGH,
                evidence="Matched in HaveIBeenPwned database",
            ),
        ]

        self.mock_request = AIAnalysisRequest(
            target="target-corp.com",
            target_type="domain",
            risk_score=78.0,
            nodes=[n.model_dump() for n in self.mock_nodes],
            findings=[f.model_dump() for f in self.mock_findings],
            edges=[],
        )

    async def test_heuristic_fallback_generation(self):
        """Ensures heuristic engine produces compliant threat report without API key"""
        report = await self.service.analyze(self.mock_request)

        self.assertEqual(report.status, "fallback")
        self.assertEqual(report.model, "heuristic-expert-engine")
        self.assertEqual(report.target, "target-corp.com")
        self.assertEqual(report.threat_level, "CRITICAL")
        self.assertTrue(len(report.executive_summary) > 50)
        self.assertTrue(len(report.attack_chain) >= 2)
        self.assertTrue(len(report.recommendations) >= 3)
        self.assertTrue(any("T1596" in t or "T1046" in t or "T1589" in t for t in report.mitre_techniques))

    async def test_gemini_api_success_mock(self):
        """Ensures service parses valid Gemini 1.5 Flash JSON responses properly"""
        mock_ai_json = {
            "executiveSummary": "Target corporation exhibits significant perimeter exposures with open databases.",
            "threatLevel": "CRITICAL",
            "keyExposures": ["Public MySQL port 3306", "Compromised admin email"],
            "attackChain": [
                {
                    "step": 1,
                    "title": "Reconnaissance",
                    "technique": "T1596: Search Technical DBs",
                    "targetAsset": "target-corp.com",
                    "description": "Adversary discovers exposed database services.",
                    "impact": "Unrestricted external visibility",
                }
            ],
            "mitreTechniques": ["T1596", "T1046"],
            "recommendations": ["Enforce firewall drops on port 3306", "Rotate compromised credentials"],
        }

        json_payload = json_dumps(mock_ai_json)
        mock_gemini_response = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": json_payload}
                        ]
                    }
                }
            ]
        }

        service_with_key = AIReconAnalystService(api_key="mock-api-key")

        with patch("httpx.AsyncClient.post") as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = mock_gemini_response
            mock_post.return_value = mock_resp

            report = await service_with_key.analyze(self.mock_request)

            self.assertEqual(report.status, "success")
            self.assertEqual(report.model, "gemini-1.5-flash")
            self.assertEqual(report.threat_level, "CRITICAL")
            self.assertEqual(len(report.attack_chain), 1)

    async def test_gemini_api_error_fallback(self):
        """Ensures service automatically falls back to heuristic engine when Gemini API fails"""
        service_with_key = AIReconAnalystService(api_key="mock-api-key")

        with patch("httpx.AsyncClient.post", side_effect=Exception("API Timeout or Quota Exceeded")):
            report = await service_with_key.analyze(self.mock_request)

            self.assertEqual(report.status, "fallback")
            self.assertEqual(report.model, "heuristic-expert-engine")
            self.assertEqual(report.target, "target-corp.com")
            self.assertTrue(len(report.executive_summary) > 20)

    def test_api_route_analyze_ai(self):
        """Tests POST /api/v1/analyze/ai endpoint integration"""
        payload = {
            "target": "target-corp.com",
            "target_type": "domain",
            "risk_score": 65,
            "nodes": [
                {
                    "id": "n1",
                    "type": "domain",
                    "value": "target-corp.com",
                    "label": "target-corp.com",
                    "severity": "medium",
                    "metadata": {},
                }
            ],
            "findings": [
                {
                    "id": "f1",
                    "title": "Subdomain Takeover Detected",
                    "severity": "high",
                    "evidence": "CNAME points to unclaimed AWS S3 bucket",
                }
            ],
            "edges": [],
        }

        res = self.client.post("/api/v1/analyze/ai", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("executive_summary", data)
        self.assertIn("threat_level", data)
        self.assertIn("attack_chain", data)
        self.assertIn("recommendations", data)


def json_dumps(obj):
    import json
    return json.dumps(obj)


if __name__ == "__main__":
    unittest.main()
