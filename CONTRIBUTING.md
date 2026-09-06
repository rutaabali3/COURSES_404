# Contributing to Drive to WebM Pipeline

Thank you for your interest in contributing to this project. This repository manages an automated, zero-storage, end-to-end video processing and delivery pipeline.

Please read through these guidelines to ensure a smooth contribution process.

---

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Workflow](#development-workflow)
  - [Local Testing & Verification](#local-testing--verification)
  - [Workflow & Pipeline Standards](#workflow--pipeline-standards)
- [Style and Standards](#style-and-standards)
- [Security Vulnerabilities](#security-vulnerabilities)

---

## Code of Conduct

Maintain a welcoming, inclusive, and respectful environment for everyone. Please avoid disrespectful language, harassment, or constructive criticism delivered maliciously.

---

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues and pull requests to ensure the problem has not already been reported.

When submitting a bug report, please include:
- A clear, descriptive title.
- Steps to reproduce the issue.
- Expected behavior versus actual behavior.
- Relevant logs from GitHub Actions runs (redact sensitive values and credentials).
- Operating environment details (browser, OS, runner environment).

### Suggesting Enhancements

Feature requests are welcome. When proposing enhancements:
- Explain the motivation behind the suggestion.
- Describe the expected behavior and implementation details if possible.
- Consider backwards compatibility with existing release assets and proxy setups.

### Submitting Pull Requests

1. Fork the repository and create a descriptive feature or fix branch from `main`.
2. Keep your pull requests focused on a single logical change.
3. Ensure no static video artifacts or secrets are committed into git history.
4. Verify all HTML, JS, and CSS changes in `docs/` function correctly in standard modern browsers.
5. Ensure no emojis or decorative symbols are introduced into documentation files.
6. Write clear, descriptive commit messages.
7. Open a Pull Request with a comprehensive summary of changes and testing performed.

---

## Development Workflow

### Local Testing & Verification

While the core pipeline executes within GitHub Actions runners, local static testing can be performed:

- **Frontend static site (`docs/`)**:
  Serve the `docs` folder locally using any local web server (e.g., `python -m http.server 8000` or `npx serve docs`).
  Access `library.html?demo=1` to inspect the library UI with fallback sample data.

- **Cloudflare Worker proxy (`cloudflare/media-proxy.js`)**:
  Test Worker logic using Wranglers local environment if Wrangler CLI is available (`npx wrangler dev cloudflare/media-proxy.js`).

- **Workflow verification**:
  Inspect `.github/workflows/drive-to-webm.yml` using standard YAML linters or `actionlint`.

### Workflow & Pipeline Standards

- **Zero Repository Storage**: The main branch must never accumulate binary video data. All output files must be directed to GitHub Releases or workflow artifacts.
- **Worker Matrix Isolation**: Modifications to worker sharding or progress tracking files (`api-progress-w*.json`) must maintain atomicity across parallel workers to prevent course collision.
- **Encryption Security**: AES-256 CTR encryption routines must remain compatible across OpenSSL CLI tools and browser WebCrypto API implementations.

---

## Style and Standards

- Standard JavaScript (ES6+): Clean, readable, vanilla JS without heavyweight frontend dependencies.
- HTML/CSS: Semantic HTML5 elements and responsive CSS styles.
- Bash/YAML: Clean indentation (2 spaces) and error-tolerant shell scripts (`set -euo pipefail` where applicable).
- Documentation: Detailed, structured, clear technical writing without emojis or colloquial filler.

---

## Security Vulnerabilities

If you discover a security vulnerability, please do NOT open a public issue. Report sensitive security findings directly to the project maintainers or via private vulnerability reporting.
