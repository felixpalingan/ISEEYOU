# ISEEYOU

> Next-Gen Automated OSINT & Attack Surface Intelligence Platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: In Development](https://img.shields.io/badge/Status-In%20Development-orange.svg)](#)

---

## Overview

**ISEEYOU** is an integrated Open Source Intelligence (OSINT) and External Attack Surface Management (EASM) command center designed to eliminate tool fragmentation. It aggregates multi-vector reconnaissance (subdomains, data breaches, threat intel, and exposed secrets) into an interactive, real-time correlated graph with automated remediation playbooks.

## Key Capabilities

* **Omni-Search Ingestion:** Automatically classifies target entities (Domain, Email, IP, Username) and triggers asynchronous recon modules.
* **Correlated Pivot Graph:** Visualizes attack surface relationships without the classic clutter, featuring collapsible sub-clusters.
* **Deterministic Risk Scoring:** Rule-based scoring engine calculating real-time exposure severity (0–100).
* **Automated Remediation:** Ready-to-use firewall rules (UFW, Nginx, Cloudflare WAF) and formal data takedown request templates (UU PDP & GDPR).

## Architecture Stack

* **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn UI, React Flow (`@xyflow/react`).
* **Engine:** Python FastAPI, Asyncio Worker Mesh, Server-Sent Events (SSE).
* **Data & Cache:** PostgreSQL (Supabase), Redis.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
