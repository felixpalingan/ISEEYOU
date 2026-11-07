# ADR-001: Local-First Ephemeral Intelligence Persistence Architecture

## Status
**Accepted** (2026-11-07)

## Context
ISEEYOU 2.0 performs automated Open Source Intelligence (OSINT), external attack surface mapping, digital footprint enumeration, and leak correlation. During investigations, the system synthesizes sensitive target intelligence, including:
- Personal Identifiable Information (PII): full names, handles, email addresses, affiliations, physical locations.
- Compromised credential records and leak metadata from breach hunter providers.
- Graph relationship topologies (associates, mutual circles, commit co-authors).
- User BYOK (Bring-Your-Own-Key) credentials for LLM providers (OpenAI, Anthropic, Gemini, Groq).

Under modern global data privacy regulations (such as the Indonesian Personal Data Protection Act / **UU PDP No. 27/2022** and the European Union General Data Protection Regulation / **GDPR**), centralized retention of unconsented third-party intelligence creates severe legal liability, data residency compliance challenges, and catastrophic breach impact if an investigation server is compromised.

## Decision
We adopt a **Local-First, Privacy-Preserving Ephemeral Architecture**:

1. **Client-Side Authoritative State**:
   - Investigation sessions, graph nodes, edges, dossier records, notes, and annotations are stored locally in the investigator's browser memory and isolated `localStorage`.
   - Complete investigation snapshots are serialized into portable, human-readable `.case.json` files that can be exported, shared offline, encrypted, or loaded on demand.

2. **Ephemeral Backend Worker Mesh**:
   - The FastAPI worker engine (`apps/worker-engine`) acts strictly as a stateless orchestrator and real-time streaming transit pipe via Server-Sent Events (SSE).
   - In-memory scan sessions are governed by a bounded `SessionStore` (maximum 100 recent sessions with an automatic 2-hour TTL eviction policy).
   - Once a scan completes or is cancelled, memory is evicted and `EventBus` buffers are automatically purged.
   - The engine does not write target data, credentials, or PII to disks, logs, or external persistent databases.

3. **Zero-Server BYOK Token Handling**:
   - User-supplied AI API tokens remain strictly in the browser client and are transmitted ephemerally via request payloads only when an on-demand AI Detective synthesis is explicitly triggered.

## Consequences

### Positive Consequences (What Becomes Easier)
- **Zero Centralized Breach Liability**: Even if the worker engine host server is compromised, attackers find zero persistent target dossiers, leaked credentials, or historical case files.
- **Privacy Compliance by Default**: Investigator actions inherently comply with data minimization and storage limitation mandates of UU PDP and GDPR.
- **Offline & Air-Gapped Portability**: Investigators can export `.case.json` snapshots and inspect them offline without maintaining database migrations or remote sync connections.
- **Predictable Resource Footprint**: Bounded memory limits and automatic TTL eviction prevent worker nodes from experiencing memory exhaustion.

### Trade-Offs (What Becomes Harder)
- **Multi-Device Sync**: Synchronizing case state across different workstations requires manually transferring or sharing `.case.json` files.
- **Team Collaboration**: Real-time collaborative multi-investigator editing on a single canvas is not natively supported in the local-first layer.

### Future Upgrade Path
For enterprise deployments requiring multi-investigator teamwork, an optional end-to-end encrypted (E2EE) synchronizer (e.g., Supabase / PostgreSQL with client-side envelope encryption) can be introduced as an adapter without altering the core OSINT provider interfaces or the `@iseeyou/shared-types` domain model.
