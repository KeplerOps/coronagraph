# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.4.0] - 2026-03-08

### Security

- **Dependency upgrades**: hono (4.12.3 → 4.12.5), @hono/node-server (→ 1.19.11), esbuild (→ 0.27.3), express-rate-limit (→ 8.3.0) to resolve 6 known vulnerabilities including arbitrary file access, auth bypass, cookie/SSE injection, IPv4-mapped IPv6 bypass, and dev server exposure

## [0.3.0] - 2026-03-08

### Added

- **Sources table auto-population**: collectors now register themselves in the `sources` table on each collection run via `registerSources()`, with upsert to keep metadata current

## [0.2.0] - 2026-03-07

### Added

- **CI/CD pipeline** via GitHub Actions (`deploy.yml`) with change detection, environment routing (dev/prod), and skip flags (`[skip ci]`, `[skip tests]`) for dev branches
- **Reusable quality workflow** (`_quality.yml`): Biome linting/formatting, dependency audit, Checkov IaC security scanning, Terraform validation, and Bun test suite
- **Reusable Terraform workflow** (`_terraform.yml`): plan/apply with OIDC-based AWS authentication, PR plan comments, and environment-aware role assumption
- **Pre-commit hooks** (`.pre-commit-config.yaml`): trailing whitespace, YAML/JSON validation, large file check, merge conflict detection, private key detection, Terraform fmt/validate, Biome check, dependency audit, Checkov IaC scanning, and Bun tests
- **Biome v2 configuration** (`biome.json`): linting and formatting for `src/` and `tests/` with 2-space indentation, organized imports, and project-specific rule overrides
