# Contributing to ISEEYOU ⚡

Thank you for your interest in contributing to **ISEEYOU 2.0**! We welcome community contributions to help improve this interactive OSINT Lead-Chaining Caseboard, Target Dossier Workbench, and External Attack Surface Management platform.

---

## Code of Conduct

Please treat everyone with respect, kindness, and professionalism. We are committed to providing a friendly, safe, and inclusive experience for all contributors regardless of experience level.

---

## How Can I Contribute?

### 1. Reporting Bugs
- Check existing [GitHub Issues](https://github.com/felixpalingan/ISEEYOU/issues) before opening a new issue to avoid duplicates.
- Provide a clear and descriptive title.
- Detail the steps to reproduce the issue, expected vs. actual behavior, and include console logs, terminal output, or browser screenshots if applicable.
- Specify your operating system, browser, Node.js version, and Python version.

### 2. Suggesting Features & OSINT Extractors
- Open a GitHub issue with the `[Feature Request]` tag.
- Clearly describe the proposed feature or passive OSINT provider, the investigation workflow it solves, and how it aligns with ISEEYOU's vision of passive, correlated intelligence.

### 3. Submitting Pull Requests (PR)

1. **Fork the Repository** and clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/ISEEYOU.git
   cd ISEEYOU
   ```

2. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/your-feature-name
   # or for bugfixes:
   git checkout -b fix/your-bugfix-name
   ```

3. **Install Dependencies**:
   ```bash
   # Install root and frontend workspace dependencies
   npm install

   # Setup Python virtual environment for worker engine
   cd apps/worker-engine
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   cd ../..
   ```

4. **Follow Code Style & Architecture Conventions**:
   - **Strict TypeScript**: Ensure full type safety using models from `@iseeyou/shared-types`. Avoid untyped `any`.
   - **Modern Python**: Adhere to PEP 8 standards with asynchronous `asyncio` and `httpx` routines inheriting from `BaseOSINTProvider`.
   - **Zero-Trust Security**: Never bypass or weaken the Anti-SSRF validation engine (`apps/worker-engine/engine/core/security.py`).
   - **Design System**: Follow the Carbon Obsidian color palette (`#090B10` canvas, `#0F1219` elevated panels, `#131720` cards, `#38BDF8` sky accent) and `tabular-nums` alignment.
   - **Documentation Language**: All code comments, user-facing strings, commit messages, and documentation must strictly be written in English.

5. **Verify Tests & Builds Locally**:
   ```bash
   # Build shared types and Next.js web application
   npm run build:types
   npm run build --workspace=apps/web

   # Run Python engine unit tests (90 tests)
   python -m pytest apps/worker-engine/tests -v

   # Run Playwright E2E browser test suite (12 tests)
   npx --workspace=apps/web playwright test
   ```
   Ensure all tests pass and builds complete with zero errors.

6. **Commit with Conventional Commits**:
   - `feat(scope)`: New features or OSINT extractor enhancements
   - `fix(scope)`: Bug fixes
   - `refactor(scope)`: Code refactoring without behavioral changes
   - `style(scope)`: UI and theme refinements
   - `docs(scope)`: Documentation additions or revisions
   - `test(scope)`: New unit or E2E tests
   - `chore(scope)`: Maintenance, dependencies, and configuration

7. **Push to Your Fork & Open a Pull Request**:
   Push your branch and open a PR against the `main` branch. Provide a concise summary of the changes and link to any relevant issues.

---

## Security & Ethics Policy

- **Passive Intelligence Only**: ISEEYOU strictly performs passive OSINT using public APIs and records. Never submit modules that execute invasive attacks (e.g., active vulnerability exploits, SQL injection scanners, brute-force attacks).
- **Anti-SSRF Enforcement**: Any outbound HTTP or DNS requests must be guarded against private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopbacks (`127.0.0.1`), and cloud metadata (`169.254.169.254`).
- **Zero Leaked Credentials**: Never commit active secrets, API keys, or private `.env` files into version control.
