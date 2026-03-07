# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **CI/CD pipeline** via GitHub Actions (`deploy.yml`) with change detection, environment routing (dev/prod), and skip flags (`[skip ci]`, `[skip tests]`) for dev branches
- **Reusable quality workflow** (`_quality.yml`): Biome linting/formatting, dependency audit, Checkov IaC security scanning, Terraform validation, and Bun test suite
- **Reusable Terraform workflow** (`_terraform.yml`): plan/apply with OIDC-based AWS authentication, PR plan comments, and environment-aware role assumption
- **Pre-commit hooks** (`.pre-commit-config.yaml`): trailing whitespace, YAML/JSON validation, large file check, merge conflict detection, private key detection, Terraform fmt/validate, Biome check, dependency audit, Checkov IaC scanning, and Bun tests
- **Biome v2 configuration** (`biome.json`): linting and formatting for `src/` and `tests/` with 2-space indentation, organized imports, and project-specific rule overrides
