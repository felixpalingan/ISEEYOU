"""
AI Detective & Recon Analyst Service (ISEEYOU 2.0 - Step 1.4)
Synthesizes OSINT lead-chaining telemetry into:
1. Executive Dossier & Identity Correlation Summary
2. Predicted Alternate Handles / Emails (Lead Chaining Hypotheses)
3. Tactical Google Dork Matrix (Private Account Comment Bypass, LinkedIn Pivot, Document Leaks)
4. Attack Surface / Threat Chain Hypothesis

Supports Bring-Your-Own-Key (BYOK) across 4 providers:
- Google Gemini (gemini-1.5-flash / gemini-2.0-flash)
- Groq (llama-3.3-70b-versatile)
- OpenAI / OpenRouter (gpt-4o-mini / custom model)
- Local Ollama (http://localhost:11434)
With a 100% deterministic offline OSINT Detective Heuristic Fallback Engine.
"""

import logging
import json
import re
import httpx
from datetime import datetime
from typing import Dict, Any, List, Optional, Set

from engine.config import settings
from engine.models.entities import (
    AIAnalysisRequest,
    AIAnalysisResponse,
    AttackChainStep,
    PredictedLead,
    SuggestedDork,
)

logger = logging.getLogger("iseeyou.services.ai_analyst")


def _clean_llm_json(raw_text: str) -> Dict[str, Any]:
    """Strips markdown fences from LLM output and parses JSON safely."""
    clean = raw_text.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    elif clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()
    return json.loads(clean)


class AIReconAnalystService:
    """
    Hybrid AI Detective & Attack Surface Copilot for ISEEYOU 2.0.
    """

    GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
    OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
    OLLAMA_API_URL = "http://localhost:11434/api/chat"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or settings.GEMINI_API_KEY

    async def analyze(self, req: AIAnalysisRequest) -> AIAnalysisResponse:
        """
        Routes analysis to the selected BYOK AI provider (Gemini, Groq, OpenAI/OpenRouter, or Ollama).
        Falls back gracefully to the deterministic OSINT Detective Heuristic Engine if no key is provided
        or if the upstream API call fails.
        """
        provider = (req.ai_provider or "gemini").strip().lower()
        effective_key = (req.api_key or "").strip() or (
            self.api_key.strip() if provider == "gemini" and self.api_key else ""
        )

        if provider == "ollama":
            try:
                logger.info(f"Invoking Local Ollama AI Detective for target '{req.target}'")
                return await self._call_ollama(req)
            except Exception as e:
                logger.warning(f"Ollama invocation failed ({e}). Falling back to Heuristic Engine.")
        elif effective_key:
            try:
                if provider == "groq":
                    logger.info(f"Invoking Groq API for target '{req.target}'")
                    return await self._call_openai_compatible(
                        req,
                        api_url=self.GROQ_API_URL,
                        api_key=effective_key,
                        default_model="llama-3.3-70b-versatile",
                    )
                elif provider in ("openai", "openrouter"):
                    is_openrouter = provider == "openrouter" or effective_key.startswith("sk-or-")
                    api_url = self.OPENROUTER_API_URL if is_openrouter else self.OPENAI_API_URL
                    logger.info(f"Invoking {'OpenRouter' if is_openrouter else 'OpenAI'} API for '{req.target}'")
                    return await self._call_openai_compatible(
                        req,
                        api_url=api_url,
                        api_key=effective_key,
                        default_model="gpt-4o-mini",
                    )
                else:
                    logger.info(f"Invoking Gemini Flash API for target '{req.target}'")
                    return await self._call_gemini_flash(req, api_key=effective_key)
            except Exception as e:
                logger.warning(
                    f"AI provider '{provider}' invocation failed ({e}). Falling back to Heuristic Security Engine."
                )

        # Deterministic OSINT Detective & Cybersecurity Heuristic Engine
        return self._generate_heuristic_analysis(req)

    def _build_osint_prompts(self, req: AIAnalysisRequest) -> tuple[str, str]:
        """Constructs system and user prompts tailored to OSINT Lead-Chaining & Red Team analysis."""
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
                for f in req.findings[:12]
            ],
            "nodes_sample": [
                {
                    "type": n.get("type"),
                    "value": n.get("value"),
                    "label": n.get("label"),
                    "metadata": {
                        k: v
                        for k, v in (n.get("metadata") or {}).items()
                        if k
                        in (
                            "platform",
                            "handle",
                            "full_name",
                            "bio",
                            "location",
                            "company",
                            "organization",
                            "commit_emails",
                            "relationship",
                        )
                        and v
                    },
                }
                for n in req.nodes[:20]
            ],
        }

        system_instruction = (
            "You are an elite OSINT Detective and Red Team Recon Lead for the ISEEYOU 2.0 platform. "
            "Analyze the target's digital footprint, correlate identities across platforms, predict likely "
            "alternate usernames or email addresses for lead-chaining, and generate high-precision Google Dorks "
            "(including private account comment/tag bypass dorks using site: and -inurl:). "
            "You must return ONLY a valid, parseable JSON object matching this exact schema:\n"
            "{\n"
            '  "executive_summary": "string (concise 2-3 paragraph dossier & threat synthesis)",\n'
            '  "threat_level": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",\n'
            '  "key_exposures": ["string", "string"],\n'
            '  "predicted_leads": [\n'
            '    {\n'
            '      "lead_type": "username" | "email" | "domain",\n'
            '      "value": "string (predicted handle or email)",\n'
            '      "reason": "string (why this handle/email is likely used by target)",\n'
            '      "confidence": 0.85\n'
            "    }\n"
            "  ],\n"
            '  "suggested_dorks": [\n'
            '    {\n'
            '      "title": "string",\n'
            '      "query": "string (exact Google dork query using site:, intext:, -inurl:, filetype:)",\n'
            '      "category": "Private Account Bypass" | "Cross-Platform Pivot" | "Document & Roster Leak",\n'
            '      "description": "string"\n'
            "    }\n"
            "  ],\n"
            '  "attack_chain": [\n'
            '    {\n'
            '      "step": 1,\n'
            '      "title": "string",\n'
            '      "technique": "string (e.g. MITRE ATT&CK T1593 / T1596)",\n'
            '      "target_asset": "string",\n'
            '      "description": "string",\n'
            '      "impact": "string"\n'
            "    }\n"
            "  ],\n"
            '  "mitre_techniques": ["T1593", "T1589", "T1596"],\n'
            '  "recommendations": ["string", "string"]\n'
            "}\n"
        )

        user_prompt = (
            f"Correlate and synthesize the following OSINT caseboard telemetry for target '{req.target}':\n"
            f"{json.dumps(context, indent=2)}"
        )
        return system_instruction, user_prompt

    def _parse_ai_response_payload(
        self, parsed: Dict[str, Any], req: AIAnalysisRequest, model_name: str
    ) -> AIAnalysisResponse:
        """Converts parsed LLM JSON into a validated AIAnalysisResponse, enriched with fallback dorks/leads."""
        raw_attack_chain = parsed.get("attack_chain") or parsed.get("attackChain") or []
        steps = [
            AttackChainStep(
                step=s.get("step", idx + 1),
                title=s.get("title", f"Step {idx + 1}"),
                technique=s.get("technique", "MITRE ATT&CK T1596"),
                target_asset=s.get("target_asset") or s.get("targetAsset") or req.target,
                description=s.get("description", ""),
                impact=s.get("impact", ""),
            )
            for idx, s in enumerate(raw_attack_chain)
        ]

        heuristic_leads, heuristic_dorks = self._build_deterministic_leads_and_dorks(req)

        raw_leads = parsed.get("predicted_leads") or parsed.get("predictedLeads") or []
        predicted_leads = [
            PredictedLead(
                lead_type=str(item.get("lead_type") or item.get("leadType") or "username"),
                value=str(item.get("value", "")),
                reason=str(item.get("reason", "AI correlated pattern")),
                confidence=float(item.get("confidence", 0.75)),
            )
            for item in raw_leads
            if isinstance(item, dict) and item.get("value")
        ]
        if not predicted_leads:
            predicted_leads = heuristic_leads

        raw_dorks = parsed.get("suggested_dorks") or parsed.get("suggestedDorks") or []
        suggested_dorks = [
            SuggestedDork(
                title=str(d.get("title", "Tactical Dork")),
                query=str(d.get("query", "")),
                category=str(d.get("category", "Cross-Platform Pivot")),
                description=str(d.get("description", "")),
            )
            for d in raw_dorks
            if isinstance(d, dict) and d.get("query")
        ]
        if not suggested_dorks:
            suggested_dorks = heuristic_dorks

        return AIAnalysisResponse(
            status="success",
            model=model_name,
            target=req.target,
            target_type=req.target_type,
            executive_summary=parsed.get("executive_summary")
            or parsed.get("executiveSummary")
            or f"External OSINT & attack surface assessment for {req.target}.",
            threat_level=str(
                parsed.get("threat_level") or parsed.get("threatLevel") or "HIGH"
            ).upper(),
            key_exposures=parsed.get("key_exposures") or parsed.get("keyExposures") or [],
            attack_chain=steps,
            mitre_techniques=parsed.get("mitre_techniques")
            or parsed.get("mitreTechniques")
            or [],
            recommendations=parsed.get("recommendations", []),
            predicted_leads=predicted_leads,
            suggested_dorks=suggested_dorks,
            generated_at=datetime.utcnow().isoformat(),
        )

    async def _call_gemini_flash(
        self, req: AIAnalysisRequest, api_key: Optional[str] = None
    ) -> AIAnalysisResponse:
        """Calls Google Gemini API with JSON mode prompt constraint."""
        key = api_key or self.api_key
        model_name = req.model_override or "gemini-1.5-flash"
        system_instruction, user_prompt = self._build_osint_prompts(req)

        url = f"{self.GEMINI_API_URL.format(model=model_name)}?key={key}"
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
            parsed = _clean_llm_json(raw_text)
            return self._parse_ai_response_payload(parsed, req, model_name)

    async def _call_openai_compatible(
        self,
        req: AIAnalysisRequest,
        api_url: str,
        api_key: str,
        default_model: str,
    ) -> AIAnalysisResponse:
        """Calls Groq, OpenAI, or OpenRouter chat completions endpoint in JSON mode."""
        model_name = req.model_override or default_model
        system_instruction, user_prompt = self._build_osint_prompts(req)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient(timeout=18.0) as client:
            resp = await client.post(api_url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"OpenAI-compatible API returned status {resp.status_code}: {resp.text}"
                )
            data = resp.json()
            choices = data.get("choices") or []
            if not choices:
                raise RuntimeError("Empty choices from OpenAI-compatible API")
            raw_text = choices[0]["message"]["content"]
            parsed = _clean_llm_json(raw_text)
            return self._parse_ai_response_payload(parsed, req, model_name)

    async def _call_ollama(self, req: AIAnalysisRequest) -> AIAnalysisResponse:
        """Calls local Ollama server at http://localhost:11434/api/chat."""
        model_name = req.model_override or "llama3.1"
        system_instruction, user_prompt = self._build_osint_prompts(req)
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
            "format": "json",
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(self.OLLAMA_API_URL, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Ollama API returned status {resp.status_code}: {resp.text}"
                )
            data = resp.json()
            raw_text = (data.get("message") or {}).get("content", "")
            parsed = _clean_llm_json(raw_text)
            return self._parse_ai_response_payload(parsed, req, f"ollama/{model_name}")

    def _build_deterministic_leads_and_dorks(
        self, req: AIAnalysisRequest
    ) -> tuple[List[PredictedLead], List[SuggestedDork]]:
        """
        Deterministic OSINT Lead-Chaining & Tactical Google Dork Generator.
        Extracts discovered handles, full names, emails, organizations, and locations from the graph
        to predict alternate handles/emails and craft targeted Google Dorks.
        """
        target = req.target.strip()
        handles: Set[str] = set()
        full_names: List[str] = []
        emails: Set[str] = set()
        orgs: List[str] = []
        locations: List[str] = []
        domains: Set[str] = set()

        if req.target_type == "username":
            handles.add(target.lstrip("@"))
        elif req.target_type == "email" and "@" in target:
            emails.add(target.lower())
            handles.add(target.split("@")[0].lower())
        elif req.target_type == "domain":
            domains.add(target.lower())

        for n in req.nodes:
            n_type = str(n.get("type", "")).lower()
            n_val = str(n.get("value", "")).strip()
            meta = n.get("metadata") or {}

            if meta.get("handle"):
                handles.add(str(meta["handle"]).lstrip("@"))
            if meta.get("full_name") and meta["full_name"] not in full_names:
                full_names.append(str(meta["full_name"]))
            for fn in meta.get("full_names") or []:
                if fn and fn not in full_names:
                    full_names.append(str(fn))
            if n_type == "email" and "@" in n_val:
                emails.add(n_val.lower())
            for em in meta.get("commit_emails") or meta.get("emails") or []:
                if em and "@" in str(em):
                    emails.add(str(em).lower())
            if n_type == "organization" and n_val and n_val not in orgs:
                orgs.append(n_val)
            if meta.get("company") and meta["company"] not in orgs:
                orgs.append(str(meta["company"]))
            if n_type == "location" and n_val and n_val not in locations:
                locations.append(n_val)
            if meta.get("location") and meta["location"] not in locations:
                locations.append(str(meta["location"]))
            if n_type == "domain" and "." in n_val:
                domains.add(n_val.lower())

        primary_handle = next(iter(handles), target.split("@")[0].lstrip("@"))
        primary_name = full_names[0] if full_names else None
        primary_org = orgs[0] if orgs else None

        # 1. Generate Predicted Leads (Alternate Handles & Emails)
        predicted_leads: List[PredictedLead] = []
        base_clean = re.sub(r"[^a-zA-Z0-9]", "", primary_handle).lower()
        if base_clean and base_clean != primary_handle.lower():
            predicted_leads.append(
                PredictedLead(
                    lead_type="username",
                    value=base_clean,
                    reason=f"Stripped punctuation variant of '{primary_handle}'",
                    confidence=0.85,
                )
            )

        if primary_name and " " in primary_name.strip():
            parts = [
                re.sub(r"[^a-zA-Z0-9]", "", p).lower()
                for p in primary_name.strip().split()
                if p
            ]
            if len(parts) >= 2:
                first_last = f"{parts[0]}{parts[-1]}"
                dot_variant = f"{parts[0]}.{parts[-1]}"
                if first_last not in {h.lower() for h in handles}:
                    predicted_leads.append(
                        PredictedLead(
                            lead_type="username",
                            value=first_last,
                            reason=f"Derived from discovered full name '{primary_name}'",
                            confidence=0.82,
                        )
                    )
                if not emails:
                    predicted_leads.append(
                        PredictedLead(
                            lead_type="email",
                            value=f"{dot_variant}@gmail.com",
                            reason=f"Standard personal email pattern for '{primary_name}'",
                            confidence=0.70,
                        )
                    )
                for dom in sorted(domains)[:1]:
                    corp_email = f"{parts[0]}@{dom}"
                    if corp_email not in emails:
                        predicted_leads.append(
                            PredictedLead(
                                lead_type="email",
                                value=corp_email,
                                reason=f"First-name mailbox pattern on discovered domain '{dom}'",
                                confidence=0.78,
                            )
                        )
        elif primary_handle and not emails:
            predicted_leads.append(
                PredictedLead(
                    lead_type="email",
                    value=f"{primary_handle.lower()}@gmail.com",
                    reason=f"Direct Gmail correlation for handle '{primary_handle}'",
                    confidence=0.72,
                )
            )

        # 2. Generate Tactical Google Dorks (including Private Account Comment/Tag Bypass)
        dorks: List[SuggestedDork] = [
            SuggestedDork(
                title="Instagram Private Account Comment & Tag Bypass",
                query=f'site:instagram.com "{primary_handle}" -inurl:instagram.com/{primary_handle}',
                category="Private Account Bypass",
                description=(
                    "Finds public posts, reels, and comment threads where this Instagram handle "
                    "commented or was tagged by friends, even if the target's own profile is private."
                ),
            ),
            SuggestedDork(
                title="TikTok Public Mentions & Replies Extraction",
                query=f'site:tiktok.com "{primary_handle}" -inurl:"@{primary_handle}"',
                category="Private Account Bypass",
                description="Uncovers TikTok videos, duets, and comment replies mentioning the target handle.",
            ),
            SuggestedDork(
                title="X / Twitter Replies & External Mentions",
                query=f'(site:x.com OR site:twitter.com) "{primary_handle}" -inurl:status',
                category="Private Account Bypass",
                description="Surfaces public threads and interactions referencing the target handle on X/Twitter.",
            ),
        ]

        if primary_name:
            org_clause = f' "{primary_org}"' if primary_org else ""
            dorks.append(
                SuggestedDork(
                    title="LinkedIn Identity & Career Pivot",
                    query=f'site:linkedin.com/in/ "{primary_name}"{org_clause}',
                    category="Cross-Platform Pivot",
                    description=f"Locates LinkedIn profile matching real name '{primary_name}'"
                    + (f" and affiliation '{primary_org}'." if primary_org else "."),
                )
            )
            dorks.append(
                SuggestedDork(
                    title="Leaked Documents, CV & University/Company Rosters",
                    query=f'("{primary_name}" OR "{primary_handle}") (filetype:pdf OR filetype:xlsx OR filetype:docx)',
                    category="Document & Roster Leak",
                    description="Searches indexed PDFs, spreadsheets, and documents for resumes, attendance rosters, or directories.",
                )
            )
        else:
            dorks.append(
                SuggestedDork(
                    title="Cross-Platform Handle & Document Footprint",
                    query=f'"{primary_handle}" (filetype:pdf OR filetype:xlsx OR site:linkedin.com/in/ OR site:t.me)',
                    category="Document & Roster Leak",
                    description="Searches LinkedIn, Telegram public channels, and indexed documents for the handle.",
                )
            )

        if emails:
            first_email = sorted(emails)[0]
            dorks.append(
                SuggestedDork(
                    title="Public Paste, Forum & Mailing List Email Exposure",
                    query=f'"{first_email}" (site:pastebin.com OR site:github.com OR site:gitlab.com OR filetype:txt OR filetype:sql)',
                    category="Document & Roster Leak",
                    description=f"Checks public code hosts, mailing lists, and text dumps for '{first_email}'.",
                )
            )

        return predicted_leads[:6], dorks[:6]

    def _generate_heuristic_analysis(
        self, req: AIAnalysisRequest
    ) -> AIAnalysisResponse:
        """
        High-fidelity deterministic rule-based OSINT Detective & Cybersecurity Heuristic Engine.
        Guarantees 100% offline availability, sub-second execution, and zero token costs.
        """
        target = req.target
        findings = req.findings
        nodes = req.nodes
        risk_score = req.risk_score

        predicted_leads, suggested_dorks = self._build_deterministic_leads_and_dorks(req)

        # Identify exposures
        has_critical = any(
            str(f.get("severity", "")).lower() == "critical" for f in findings
        )
        has_high = any(str(f.get("severity", "")).lower() == "high" for f in findings)

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

        if risk_score >= 70 or has_critical:
            threat_level = "CRITICAL"
        elif risk_score >= 40 or has_high:
            threat_level = "HIGH"
        elif risk_score >= 15:
            threat_level = "MEDIUM"
        else:
            threat_level = "LOW"

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

        # Add identity-specific exposures if scanning a person/username/email
        commit_emails = [
            n.get("value") for n in nodes if n.get("type") == "email"
        ]
        associates = [
            n.get("value") for n in nodes if n.get("type") == "associate"
        ]
        if commit_emails:
            key_exposures.append(
                f"Discovered Email Leads: {len(commit_emails)} email address(es) correlated ({', '.join(str(e) for e in commit_emails[:3])})"
            )
        if associates:
            key_exposures.append(
                f"Mapped Inner Circle: {len(associates)} mutual connection(s) / collaborator(s) identified"
            )

        if not key_exposures:
            key_exposures.append(
                "Footprint Hygiene: Minimal unauthenticated high-severity exposures detected."
            )

        attack_chain: List[AttackChainStep] = [
            AttackChainStep(
                step=1,
                title="Cross-Platform OSINT & Attack Surface Enumeration",
                technique="MITRE ATT&CK T1593 / T1596: Search Open Websites & Technical Databases",
                target_asset=target,
                description=(
                    f"Investigator correlates {len(nodes)} discovered entities across social profiles, "
                    f"developer commit histories, and DNS/certificate registries."
                ),
                impact="Full mapping of target identity aliases, personal/corporate emails, and perimeter assets.",
            )
        ]

        if db_exposed:
            db_finding = db_exposed[0]
            attack_chain.append(
                AttackChainStep(
                    step=2,
                    title="Direct Public Database Exploitation",
                    technique="MITRE ATT&CK T1190: Exploit Public-Facing Application",
                    target_asset=str(db_finding.get("title", "Database Service")),
                    description=(
                        f"Threat actor launches targeted attacks against exposed database service "
                        f"({db_finding.get('title')}) bypassing edge proxies."
                    ),
                    impact="Unauthorized data access or service compromise.",
                )
            )
        elif breaches_found or commit_emails:
            attack_chain.append(
                AttackChainStep(
                    step=2,
                    title="Identity Lead-Chaining & Credential Correlation",
                    technique="MITRE ATT&CK T1589.002: Gather Victim Identity Information: Email Addresses",
                    target_asset=", ".join(str(e) for e in commit_emails[:2]) or target,
                    description=(
                        "Extracted commit/bio emails and handles are chained into breach registries, "
                        "Gravatar/PGP lookups, and targeted spear-phishing or credential reuse checks."
                    ),
                    impact="De-anonymization of target persona and account takeover risk across linked platforms.",
                )
            )
        elif cname_takeover:
            attack_chain.append(
                AttackChainStep(
                    step=2,
                    title="Dangling CNAME Domain Hijacking",
                    technique="MITRE ATT&CK T1584.004: Compromise Infrastructure: DNS Server",
                    target_asset=str(cname_takeover[0].get("title", "Subdomain")),
                    description="Attacker claims dangling cloud resource pointed to by stale DNS record.",
                    impact="Subdomain takeover and phishing risk.",
                )
            )
        else:
            attack_chain.append(
                AttackChainStep(
                    step=2,
                    title="Social Graph Pivoting & Dork Extraction",
                    technique="MITRE ATT&CK T1593.001: Search Social Media",
                    target_asset=target,
                    description=(
                        "Investigator pivots through two-way mutual connections and applies site:/intext: "
                        "Google dorks to uncover public comments and tags from private accounts."
                    ),
                    impact="Discovery of secondary social accounts, real-world affiliations, and leaked documents.",
                )
            )

        attack_chain.append(
            AttackChainStep(
                step=3,
                title="Lateral Pivot Across Linked Affiliations",
                technique="MITRE ATT&CK T1591: Gather Victim Org Information",
                target_asset="Affiliated Organizations & Personal Domains",
                description=(
                    "Using discovered corporate/campus domains and collaborator handles, the investigation "
                    "expands into organizational infrastructure and shared repositories."
                ),
                impact="Complete situational awareness of the target's technical and social ecosystem.",
            )
        )

        exec_summary = (
            f"Automated OSINT & reconnaissance correlation for '{target}' mapped {len(nodes)} connected "
            f"entities, {len(findings)} intelligence indicator(s), and an exposure score of "
            f"{int(risk_score)}/100 ({threat_level} Exposure Level).\n\n"
            f"The AI Detective engine generated {len(predicted_leads)} predicted lead hypothesis(es) "
            f"and {len(suggested_dorks)} tactical Google Dork queries to assist with cross-platform "
            f"lead-chaining and private account comment/tag discovery."
        )

        recommendations = [
            "Git Commit Email Hygiene: Configure git user.email to use a privacy-preserving noreply address to prevent personal email leakage in public commit logs.",
            "Handle Decoupling: Avoid reusing identical username handles across anonymous community forums (Reddit/HN) and real-name professional profiles (LinkedIn/GitHub).",
            "Multi-Factor & Breach Remediation: Rotate passwords on any email address flagged in k-anonymity breach checks and enforce hardware-backed 2FA.",
            "Perimeter & DNS Hardening: Close unauthenticated database ports and remove stale CNAME records on personal or corporate domains.",
        ]

        mitre_techs = [
            "T1593 (Search Open Websites/Domains)",
            "T1589 (Gather Victim Identity Info)",
            "T1596 (Search Open Technical Databases)",
            "T1190 (Exploit Public-Facing App)",
            "T1078 (Valid Accounts)",
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
            predicted_leads=predicted_leads,
            suggested_dorks=suggested_dorks,
            generated_at=datetime.utcnow().isoformat(),
        )


ai_analyst_service = AIReconAnalystService()
