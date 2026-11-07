# Security Policy 🛡️

The maintainers of **ISEEYOU** take cybersecurity, privacy, and system integrity seriously. We appreciate the security community's efforts to responsibly disclose any vulnerabilities.

---

## Supported Versions

Only the latest release on the `main` branch is actively supported with security updates.

| Version | Supported          |
| :---    | :---               |
| `main` (2.0.x) | :white_check_mark: |
| `< 2.0` | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability or bypass in ISEEYOU (e.g., SSRF bypass, XSS via OSINT metadata, prompt injection, or credential leak), **please do NOT report it via public GitHub issues, pull requests, or public discussions**.

Instead, please report the vulnerability privately through one of the following channels:

1. **GitHub Security Advisory**: Submit a private advisory on GitHub via the [Security Advisories tab](https://github.com/felixpalingan/ISEEYOU/security/advisories/new).
2. **Direct Maintainer Contact**: Reach out privately to the repository maintainer via GitHub ([@felixpalingan](https://github.com/felixpalingan)).

### What to Include in Your Report

To help us triage, validate, and remediate the issue quickly, please provide:
- A clear description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- Affected components (e.g., Worker Engine providers, Anti-SSRF validator, SSE stream, Next.js UI, or MCP server).
- Recommended fixes or mitigations, if known.

---

## Response Timeline

- **Initial Acknowledgment**: Within 48 hours of receipt.
- **Triage & Status Update**: Within 5 business days detailing validation results and target remediation timeline.
- **Resolution**: A coordinated security patch will be prepared, verified, and released before any public disclosure.

---

## Security Architecture & Guardrails

ISEEYOU 2.0 is engineered with defense-in-depth security controls:
- **Dual-Layer Zero-Trust Anti-SSRF Engine**: Both the TypeScript frontend/gateway (`packages/shared-types/src/entities.ts`) and the Python FastAPI worker engine (`apps/worker-engine/engine/core/security.py`) validate target inputs and resolved IP addresses against loopback (`127.0.0.0/8`, `::1`), RFC 1918 private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local and cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`), and DNS rebinding wildcard domains (`*.nip.io`, `*.sslip.io`).
- **Client-Side BYOK Isolation**: Bring-Your-Own-Key (BYOK) AI tokens entered in the web interface are stored locally in the user's browser and transmitted only over direct analysis requests without being persisted on the backend server.
- **Mandatory Credential Masking**: Exported PDF and Markdown dossiers automatically redact sensitive passwords, tokens, and secrets by default.
- **Zero Hardcoded Secrets**: Never commit active secrets, service role keys, or production API tokens into version control.
