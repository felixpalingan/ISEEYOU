"""
ISEEYOU 2.0 Model Context Protocol (MCP) Server (Step 1.4)
Exposes ISEEYOU's OSINT Lead-Chaining & Reconnaissance tools over MCP JSON-RPC 2.0 (stdio)
so external AI agents (Claude Desktop, Cursor, Windsurf, OpenClaw) can autonomously
hunt leads, extract commit emails, map mutual connections, correlate emails, and generate dorks.

Usage in Claude Desktop / Cursor MCP config:
{
  "mcpServers": {
    "iseeyou-osint": {
      "command": "python",
      "args": ["-m", "engine.mcp_server"],
      "cwd": "apps/worker-engine"
    }
  }
}
"""

import asyncio
import json
import sys
from typing import Dict, Any, List

from engine.models.entities import EntityType, AIAnalysisRequest
from engine.providers.deep_profile_extractor import deep_profile_extractor_provider
from engine.providers.connection_mapper import connection_mapper_provider
from engine.providers.email_correlator import email_correlator_provider
from engine.providers.social_scanner import SocialPresenceScanner
from engine.services.ai_analyst import ai_analyst_service

social_scanner_provider = SocialPresenceScanner()


MCP_TOOLS: List[Dict[str, Any]] = [
    {
        "name": "osint_deep_profile_hunt",
        "description": (
            "Extracts deep identity leads from a username or email across GitHub, Keybase, Reddit, "
            "and HackerNews: Full Name, Avatar, Bio, Location, Company/Campus, Personal Website, "
            "and hidden Commit Author Emails."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "username": {
                    "type": "string",
                    "description": "Target username handle (e.g. 'torvalds')",
                }
            },
            "required": ["username"],
        },
    },
    {
        "name": "osint_map_mutual_connections",
        "description": (
            "Maps who the target knows ('Dia kenal siapa aja'): calculates 2-way mutual follow "
            "connections (followers ∩ following), repository co-authors, and public organization memberships."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "username": {
                    "type": "string",
                    "description": "Target username handle",
                }
            },
            "required": ["username"],
        },
    },
    {
        "name": "osint_correlate_email",
        "description": (
            "Pivots from an email address to discover Gravatar profiles/avatars, OpenPGP cryptographic "
            "User IDs (Real Name), reverse-matched GitHub accounts, and custom company/campus domains."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "email": {
                    "type": "string",
                    "description": "Target email address",
                }
            },
            "required": ["email"],
        },
    },
    {
        "name": "osint_scan_social_platforms",
        "description": "Scans a username handle across 16+ social, developer, and community platforms.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "username": {
                    "type": "string",
                    "description": "Target username handle",
                }
            },
            "required": ["username"],
        },
    },
    {
        "name": "osint_generate_tactical_dorks",
        "description": (
            "Generates targeted Google Dorks (including Private Instagram/TikTok/X comment & tag bypass "
            "dorks using site: and -inurl:, LinkedIn pivots, and leaked PDF/XLSX roster dorks)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "description": "Primary username, email, or domain",
                },
                "full_name": {
                    "type": "string",
                    "description": "Optional known full name of the target",
                },
                "organization": {
                    "type": "string",
                    "description": "Optional known company or university",
                },
            },
            "required": ["target"],
        },
    },
]


def list_mcp_tools() -> List[Dict[str, Any]]:
    """Returns the MCP tool definitions."""
    return MCP_TOOLS


async def call_mcp_tool_direct(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Executes an ISEEYOU OSINT tool and returns structured JSON results."""
    if name == "osint_deep_profile_hunt":
        username = str(arguments.get("username", "")).strip()
        nodes = []
        findings = []
        async for ev in deep_profile_extractor_provider.execute_recon(
            username, EntityType.USERNAME, "mcp-session"
        ):
            if ev.get("type") == "node":
                nodes.append(ev["data"])
            elif ev.get("type") == "vuln":
                findings.append(ev["data"])
        return {"tool": name, "target": username, "nodes": nodes, "findings": findings}

    elif name == "osint_map_mutual_connections":
        username = str(arguments.get("username", "")).strip()
        nodes = []
        findings = []
        async for ev in connection_mapper_provider.execute_recon(
            username, EntityType.USERNAME, "mcp-session"
        ):
            if ev.get("type") == "node":
                nodes.append(ev["data"])
            elif ev.get("type") == "vuln":
                findings.append(ev["data"])
        return {"tool": name, "target": username, "nodes": nodes, "findings": findings}

    elif name == "osint_correlate_email":
        email = str(arguments.get("email", "")).strip()
        nodes = []
        findings = []
        async for ev in email_correlator_provider.execute_recon(
            email, EntityType.EMAIL, "mcp-session"
        ):
            if ev.get("type") == "node":
                nodes.append(ev["data"])
            elif ev.get("type") == "vuln":
                findings.append(ev["data"])
        return {"tool": name, "target": email, "nodes": nodes, "findings": findings}

    elif name == "osint_scan_social_platforms":
        username = str(arguments.get("username", "")).strip()
        nodes = []
        async for ev in social_scanner_provider.execute_recon(
            username, EntityType.USERNAME, "mcp-session"
        ):
            if ev.get("type") == "node":
                nodes.append(ev["data"])
        return {"tool": name, "target": username, "profiles_found": nodes}

    elif name == "osint_generate_tactical_dorks":
        target = str(arguments.get("target", "")).strip()
        full_name = arguments.get("full_name")
        org = arguments.get("organization")
        synthetic_nodes = []
        if full_name or org:
            synthetic_nodes.append(
                {
                    "type": "username",
                    "value": target,
                    "metadata": {
                        "handle": target,
                        "full_name": full_name,
                        "company": org,
                    },
                }
            )
        req = AIAnalysisRequest(
            target=target,
            target_type="username" if "@" not in target else "email",
            nodes=synthetic_nodes,
        )
        leads, dorks = ai_analyst_service._build_deterministic_leads_and_dorks(req)
        return {
            "tool": name,
            "target": target,
            "predicted_leads": [l.model_dump() for l in leads],
            "suggested_dorks": [d.model_dump() for d in dorks],
        }

    raise ValueError(f"Unknown MCP tool: {name}")


async def handle_jsonrpc_message(msg: Dict[str, Any]) -> Dict[str, Any]:
    """Handles a single MCP JSON-RPC 2.0 request."""
    method = msg.get("method")
    req_id = msg.get("id")
    params = msg.get("params") or {}

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "iseeyou-osint-mcp", "version": "2.0.0"},
            },
        }
    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"tools": list_mcp_tools()},
        }
    elif method == "tools/call":
        tool_name = params.get("name", "")
        tool_args = params.get("arguments") or {}
        try:
            result_data = await call_mcp_tool_direct(tool_name, tool_args)
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(result_data, indent=2),
                        }
                    ]
                },
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32000, "message": str(e)},
            }

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {},
    }


async def run_stdio_server():
    """Main stdio loop for MCP JSON-RPC 2.0 communication."""
    loop = asyncio.get_event_loop()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            if "id" in msg:
                resp = await handle_jsonrpc_message(msg)
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"MCP error: {e}\n")
            sys.stderr.flush()


if __name__ == "__main__":
    asyncio.run(run_stdio_server())
