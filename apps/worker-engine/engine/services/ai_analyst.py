"""
AI Recon Analyst Service (Task 4.1)
Synthesizes external reconnaissance data into an Executive Summary and
actionable Attack Chain Hypothesis using Gemini Flash API, with an intelligent
deterministic heuristic cybersecurity fallback engine.
"""

import logging
import json
import httpx
from datetime import datetime
from typing import Dict, Any, List

from engine.config import settings
from engine.models.entities import (
    AIAnalysisRequest,
    AIAnalysisResponse,
    AttackChainStep,
)

logger = logging.getLogger("iseeyou.services.ai_analyst")


class AIReconAnalystService:
    """
    AI Security Copilot for ISEEYOU Attack Surface Management.
    """

    GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or settings.GEMINI_API_KEY

    async def analyze(self, req: AIAnalysisRequest) -> AIAnalysisResponse:
        """
        Executes AI analysis on reconnaissance dataset.
        Attempts Gemini Flash API first if configured; falls back gracefully to Heuristic Engine.
        """
        if self.api_key and self.api_key.strip():
            try:
                logger.info(f"Invoking Gemini Flash API for target '{req.target}'")
                return await self._call_gemini_flash(req)
            except Exception as e:
                logger.warning(
                    f"Gemini API invocation failed ({e}). Falling back to Heuristic Security Engine."
                )

        # Fallback Heuristic Cybersecurity Engine
        return self._generate_heuristic_analysis(req)

    async def _call_gemini_flash(self, req: AIAnalysisRequest) -> AIAnalysisResponse:
        """
        Calls Google Gemini 1.5 Flash API with JSON mode prompt constraint.
        """
        # Prepare condensed telemetry context for token efficiency
        context = {
            "target": req.target,
            "target_type": req.target_type,
            "risk_score": req.risk_score,
            "total_nodes": len(req.nodes),
            "total_edges": len(req.edges),
            "findings_count": len(req.findings),
            "findings_sample": [
                {
                    "title": f.get("title"),
                    "severity": f.get("severity"),
                    "cve": f.get("cve_id") or f.get("cveId"),
                    "evidence": f.get("evidence"),
                }
                for f in req.findings[:10]
            ],
            "nodes_sample": [
                {"type": n.get("type"), "value": n.get("value"), "label": n.get("label")}
                for n in req.nodes[:15]
            ],
        }

        system_instruction = (
            "You are an elite Red Team Lead and Attack Surface Analyst for ISEEYOU ASM platform. "
            "Analyze the target reconnaissance graph and produce a realistic offensive threat assessment. "
            "You must return ONLY a valid, parseable JSON object matching this schema:\n"
            "{\n"
            '  "executive_summary": "string (concise 2-3 paragraph overview for C-level & SecOps)",\n'
            '  "threat_level": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",\n'
            '  "key_exposures": ["string", "string"],\n'
            '  "attack_chain": [\n'
            '    {\n'
            '      "step": 1,\n'
            '      "title": "string",\n'
            '      "technique": "string (e.g. MITRE ATT&CK T1596: Search Open Technical Databases)",\n'
            '      "target_asset": "string",\n'
            '      "description": "string",\n'
            '      "impact": "string"\n'
            "    }\n"
            "  ],\n"
            '  "mitre_techniques": ["T1596", "T1190"],\n'
            '  "recommendations": ["string", "string"]\n'
            "}\n"
            "Do not wrap in markdown quotes if possible, or use standard ```json."
        )

        user_prompt = (
            f"Synthesize the following external OSINT telemetry for target '{req.target}':\n"
            f"{json.dumps(context, indent=2)}"
        )

        url = f"{self.GEMINI_API_URL}?key={self.api_key}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": system_instruction + "\n\n" + user_prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.8,
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json",
            },
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Gemini API returned status {resp.status_code}: {resp.text}"
                )

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError("Empty response from Gemini API")

            raw_text = candidates[0]["content"]["parts"][0]["text"]
            # Clean possible markdown wrap
            clean_json = raw_text.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.startswith("```"):
                clean_json = clean_json[3:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            clean_json = clean_json.strip()

            parsed = json.loads(clean_json)

            steps = [
                AttackChainStep(
                    step=s.get("step", idx + 1),
                    title=s.get("title", f"Step {idx + 1}"),
                    technique=s.get("technique", "MITRE ATT&CK T1596"),
                    target_asset=s.get("target_asset", req.target),
                    description=s.get("description", ""),
                    impact=s.get("impact", ""),
                )
                for idx, s in enumerate(parsed.get("attack_chain", []))
            ]

            return AIAnalysisResponse(
                status="success",
                model="gemini-1.5-flash",
                target=req.target,
                target_type=req.target_type,
                executive_summary=parsed.get(
                    "executive_summary",
                    f"External attack surface assessment for {req.target}.",
                ),
                threat_level=parsed.get("threat_level", "HIGH").upper(),
                key_exposures=parsed.get("key_exposures", []),
                attack_chain=steps,
                mitre_techniques=parsed.get("mitre_techniques", []),
                recommendations=parsed.get("recommendations", []),
                generated_at=datetime.utcnow().isoformat(),
            )

    def _generate_heuristic_analysis(
        self, req: AIAnalysisRequest
    ) -> AIAnalysisResponse:
        """
        High-fidelity deterministic rule-based cybersecurity heuristic analyst engine.
        Guarantees 100% offline availability, sub-second execution, and zero token costs.
        """
        target = req.target
        findings = req.findings
        nodes = req.nodes
        risk_score = req.risk_score

        # Identify exposures
        has_critical = any(
            str(f.get("severity", "")).lower() == "critical" for f in findings
        )
        has_high = any(str(f.get("severity", "")).lower() == "high" for f in findings)

        # Detect specific vulnerability patterns
        db_exposed = []
        cname_takeover = []
        breaches_found = []
        open_ports = []

        for f in findings:
            title = str(f.get("title", "")).lower()
            evid = str(f.get("evidence", "")).lower()
            if any(
                db in title or db in evid
                for db in ["mysql", "3306", "postgres", "5432", "redis", "6379", "mongodb"]
            ):
                db_exposed.append(f)
            if "takeover" in title or "cname" in title or "dangling" in evid:
                cname_takeover.append(f)
            if "breach" in title or "pwned" in title or "password" in evid:
                breaches_found.append(f)

        for n in nodes:
            if n.get("type") == "port":
                open_ports.append(str(n.get("label", n.get("value", ""))))

        # Determine threat level
        if risk_score >= 70 or has_critical:
            threat_level = "CRITICAL"
        elif risk_score >= 40 or has_high:
            threat_level = "HIGH"
        elif risk_score >= 15:
            threat_level = "MEDIUM"
        else:
            threat_level = "LOW"

        # Build key exposures
        key_exposures = []
        if db_exposed:
            key_exposures.append(
                f"Exposed Database Services: {len(db_exposed)} database port(s) open to public ingress"
            )
        if breaches_found:
            key_exposures.append(
                f"Compromised Identity Assets: {len(breaches_found)} leaked credential exposure(s) detected via k-anonymity"
            )
        if cname_takeover:
            key_exposures.append(
                f"Subdomain Takeover Risk: {len(cname_takeover)} dangling CNAME record(s) vulnerable to hijacking"
            )
        if open_ports:
            key_exposures.append(
                f"Unfiltered Ingress Ports: {len(open_ports)} exposed network service(s) identified via Shodan InternetDB"
            )
        if not key_exposures:
            key_exposures.append(
                "Perimeter Hygiene: No immediate high-severity unauthenticated services discovered."
            )

        # Construct Attack Chain Hypothesis
        attack_chain: List[AttackChainStep] = []

        # Step 1: Recon & Passive Discovery
        attack_chain.append(
            AttackChainStep(
                step=1,
                title="Passive Attack Surface Enumeration",
                technique="MITRE ATT&CK T1596: Search Open Technical Databases",
                target_asset=target,
                description=(
                    f"Attacker queries public Certificate Transparency logs (crt.sh) and BGP ASN registries "
                    f"to discover {len(nodes)} infrastructure nodes without triggering target firewall alarms."
                ),
                impact="Full topological mapping of target perimeter, origin IPs, and infrastructure topology.",
            )
        )

        # Step 2: Weaponization / Exploitation Vector
        if db_exposed:
            db_finding = db_exposed[0]
            attack_chain.append(
                AttackChainStep(
                    step=2,
                    title="Direct Public Database Exploitation",
                    technique="MITRE ATT&CK T1190: Exploit Public-Facing Application",
                    target_asset=str(db_finding.get("title", "Database Service")),
                    description=(
                        f"Threat actor launches brute-force attacks or CVE exploits directly against "
                        f"exposed database service ({db_finding.get('title')}) bypassing edge WAF proxies."
                    ),
                    impact="Unauthorized data modification, complete database dump, or remote code execution via UDF.",
                )
            )
        elif breaches_found:
            attack_chain.append(
                AttackChainStep(
                    step=2,
                    title="Credential Stuffing & Identity Takeover",
                    technique="MITRE ATT&CK T1078: Valid Accounts",
                    target_asset="Corporate SSO & Internal Portals",
                    description=(
                        "Adversary correlates leaked email hashes against corporate login portals (VPN, SSO, Office 365) "
                        "using automated password spray techniques."
                    ),
                    impact="Initial access established using legitimate user privileges, bypassing perimeter intrusion detection.",
                )
            )
        elif cname_takeover:
            attack_chain.append(
                AttackChainStep(
                    step=2,
                    title="Dangling CNAME Domain Hijacking",
                    technique="MITRE ATT&CK T1584.004: Compromise Infrastructure: DNS Server",
                    target_asset=str(cname_takeover[0].get("title", "Subdomain")),
                    description=(
                        "Attacker claims dangling cloud storage or CDN resource pointed to by stale DNS record, "
                        "gaining full HTTP control over the legitimate branded subdomain."
                    ),
                    impact="High-credibility phishing campaigns, session cookie theft, and cross-site scripting against primary domain.",
                )
            )
        else:
            attack_chain.append(
                AttackChainStep(
                    step=2,
                    title="Network Service Fingerprinting & Vulnerability Scanning",
                    technique="MITRE ATT&CK T1046: Network Service Discovery",
                    target_asset=target,
                    description=(
                        "Attacker conducts targeted banner grabbing against discovered origin IPs to isolate unpatched "
                        "daemon versions and legacy microservices."
                    ),
                    impact="Identification of zero-day or unpatched N-day exploit targets.",
                )
            )

        # Step 3: Lateral Movement / Persistence
        attack_chain.append(
            AttackChainStep(
                step=3,
                title="Internal Network Pivoting & Lateral Movement",
                technique="MITRE ATT&CK T1021: Remote Services",
                target_asset="Internal VPC & Service Mesh",
                description=(
                    "Using initial compromised footholds, adversary pivots across private VPC peering links "
                    "to discover secondary cluster nodes and internal API gateways."
                ),
                impact="Breach perimeter containment failure; attacker establishes internal beachhead.",
            )
        )

        # Step 4: Objective & Data Exfiltration
        attack_chain.append(
            AttackChainStep(
                step=4,
                title="Unauthorized Data Exfiltration & Compliance Violation",
                technique="MITRE ATT&CK T1567: Exfiltration Over Web Service",
                target_asset="Corporate Data Stores & PII Repositories",
                description=(
                    "Adversary compresses sensitive intellectual property and personal data, exfiltrating "
                    "payloads over encrypted HTTPS tunnels to untracked drop servers."
                ),
                impact="Severe regulatory penalties under UU PDP No. 27/2022 and GDPR, brand reputation destruction.",
            )
        )

        # Build Executive Summary
        exec_summary = (
            f"Automated offensive reconnaissance against '{target}' revealed an external attack surface "
            f"comprising {len(nodes)} correlated assets, {len(findings)} vulnerability indicator(s), and an aggregate "
            f"risk index of {int(risk_score)}/100 ({threat_level} Threat Level).\n\n"
        )
        if threat_level in ("CRITICAL", "HIGH"):
            exec_summary += (
                f"CRITICAL PERIMETER EXPOSURE DETECTED: The target perimeter contains severe attack vectors "
                f"that permit unauthenticated initial access. Threat actors can systematically enumerate the attack surface "
                f"via passive transparency records and exploit exposed endpoints without requiring zero-day capabilities. "
                f"Immediate defensive intervention is required to isolate database ports and revoke exposed credentials."
            )
        else:
            exec_summary += (
                f"MODERATE ATTACK SURFACE HYGIENE: The external footprint displays standard perimeter hygiene "
                f"with minimal unauthenticated ingress vectors. Ongoing automated continuous monitoring is recommended "
                f"to prevent configuration drift, dangling DNS records, and shadow cloud assets."
            )

        # Build Recommendations
        recommendations = [
            "Immediate Firewall Hardening: Enforce default-deny inbound rules on public database and administrative ports (3306, 5432, 6379, 3389).",
            "Mandatory Multi-Factor Authentication: Enforce FIDO2/WebAuthn or hardware-backed MFA across all user accounts to nullify credential stuffing.",
            "DNS Zone Pruning: Audit and purge dangling CNAME records pointing to decommissioned GitHub Pages, S3 buckets, or Heroku apps.",
            "Continuous EASM Monitoring: Schedule automated weekly attack surface scans using ISEEYOU to detect newly exposed subdomains and port leaks.",
        ]

        mitre_techs = [
            "T1596 (Hardware/Software Discovery)",
            "T1190 (Exploit Public-Facing App)",
            "T1078 (Valid Accounts)",
            "T1021 (Remote Services)",
            "T1567 (Exfiltration Over Web Service)",
        ]

        return AIAnalysisResponse(
            status="fallback",
            model="heuristic-expert-engine",
            target=target,
            target_type=req.target_type,
            executive_summary=exec_summary,
            threat_level=threat_level,
            key_exposures=key_exposures,
            attack_chain=attack_chain,
            mitre_techniques=mitre_techs,
            recommendations=recommendations,
            generated_at=datetime.utcnow().isoformat(),
        )


ai_analyst_service = AIReconAnalystService()
