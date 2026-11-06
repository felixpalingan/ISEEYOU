# Security Policy 🛡️

The maintainers of **ISEEYOU** take cybersecurity and system integrity seriously. We appreciate the security community's efforts to responsibly disclose any vulnerabilities.

---

## Supported Versions

Only the latest release on the `main` branch is actively supported with security updates.

| Version | Supported          |
| :---    | :---               |
| `main`  | :white_check_mark: |
| `< 1.0` | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability or bypass in ISEEYOU (e.g., SSRF bypass, prompt injection, authentication flaw), **please do NOT report it via public GitHub issues, pull requests, or public forums**.

Instead, please report the vulnerability privately through one of the following channels:

1. **GitHub Security Advisory**: Submit a private advisory on GitHub via the [Security Advisories tab](https://github.com/felixpalingan/ISEEYOU/security/advisories/new).
2. **Direct Maintainer Contact**: Reach out privately to the lead maintainer via GitHub ([@felixpalingan](https://github.com/felixpalingan)).

### What to Include in Your Report

To help us triage, validate, and remediate the issue effectively, please provide:
- A clear description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- The affected component(s) (e.g., Worker Engine, Anti-SSRF validator, SSE direct stream, Next.js API routes).
- Suggested remediation or patch, if known.

---

## Response Timeline & SLA

- **Initial Acknowledgment**: Within 48 hours of receipt.
- **Triage & Status Update**: Within 5 business days detailing validation results and target remediation timeline.
- **Resolution & Release**: A coordinated security patch will be prepared, tested, and released prior to any public disclosure.

---

## Security Architecture & Guardrails

ISEEYOU is engineered with a strict defensive security posture:
- **Zero-Trust Anti-SSRF Engine**: All outbound worker tasks rigorously inspect target hostnames and resolved IP addresses against loopback (`127.0.0.0/8`, `::1`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), cloud instance metadata endpoints (`169.254.169.254`, `metadata.google.internal`), carrier-grade NAT, and DNS rebinding wildcard domains (`*.nip.io`, `*.sslip.io`, etc.).
- **Rate Limiting**: Sliding-window rate limiters protect streaming endpoints against denial-of-service abuse.
- **Input Sanitization**: Multi-layer Zod and Pydantic schemas sanitize and strip protocol schemes, credentials, path traversal tokens, null bytes, and control characters before reaching backend workers.
- **Passive Footprint**: All intelligence modules interact exclusively with public, authoritative DNS providers and passive OSINT APIs without engaging in invasive target exploitation.
