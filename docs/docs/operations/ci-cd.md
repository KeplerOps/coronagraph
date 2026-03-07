# CI/CD Pipeline

Coronagraph uses GitHub Actions for continuous integration and deployment, with pre-commit hooks for local development checks.

## GitHub Actions Workflows

### deploy.yml (Orchestrator)

The main workflow triggers on pull requests, pushes to `main`/`dev`, and manual dispatch. It:

1. **Detects changes** using `dorny/paths-filter` to skip unnecessary jobs
2. **Routes environments**: PRs targeting `main` → prod, everything else → dev
3. **Calls reusable workflows** for quality checks and Terraform operations

#### Skip Flags (dev only)

Add these to commit messages on dev-targeting branches:

| Flag | Effect |
|------|--------|
| `[skip ci]` | Skips quality checks entirely |
| `[skip tests]` | Skips tests but still runs linting |

These flags are ignored on prod-targeting branches.

### _quality.yml (Reusable)

Runs on every PR and push when app files change:

| Job | What it does |
|-----|-------------|
| **Lint & Format** | `bunx @biomejs/biome check src/ tests/` |
| **Dependency Audit** | `bun audit` (soft fail) |
| **IaC Security** | Checkov scan on `terraform/` (soft fail) |
| **Terraform Validate** | `terraform fmt -check`, `init -backend=false`, `validate` |
| **Tests** | `bun test` (skippable via flag) |

### _terraform.yml (Reusable)

Runs when Terraform files change:

| Job | What it does |
|-----|-------------|
| **Plan** | `terraform plan` with OIDC auth, posts plan as PR comment |
| **Apply** | `terraform apply -auto-approve` on push to `main`/`dev` (not on PRs) |

AWS authentication uses OIDC (no long-lived credentials):

- **Dev**: `AWS_ROLE_ARN_DEV` secret
- **Prod**: `AWS_ROLE_ARN` secret

## Pre-commit Hooks

Install with:

```bash
pip install pre-commit
pre-commit install
```

Hooks run in three stages on every commit:

### Stage 1: Fast Checks
- Trailing whitespace, end-of-file fixer
- YAML/JSON validation
- Large file detection (>500KB)
- Merge conflict markers
- Private key detection (excludes `tests/`)
- Terraform fmt and validate
- Biome lint + format (auto-fixes with `--write`)

### Stage 2: Security
- `bun audit` for dependency vulnerabilities
- Checkov IaC scan on `terraform/`

### Stage 3: Tests
- `bun test` (runs last since it's the slowest)

## Biome

[Biome v2](https://biomejs.dev/) handles linting and formatting for TypeScript/JavaScript:

```bash
# Check (CI mode — no writes)
bunx @biomejs/biome check src/ tests/

# Check and auto-fix
bunx @biomejs/biome check --write src/ tests/
```

Configuration in `biome.json`:

- **Scope**: `src/` and `tests/`
- **Indent**: 2 spaces
- **Imports**: auto-organized
- **Rules**: recommended + `noExplicitAny` as warning, `noAssignInExpressions` off

## GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ROLE_ARN` | IAM role ARN for prod Terraform operations (OIDC) |
| `AWS_ROLE_ARN_DEV` | IAM role ARN for dev Terraform operations (OIDC) |
| `DB_PASSWORD` | Master password for the RDS PostgreSQL database |

## AWS Infrastructure

All infrastructure is in **us-east-2**.

Each environment has:

- **OIDC provider** for GitHub Actions (no long-lived credentials)
- **IAM role** `github-actions-coronagraph` scoped to `repo:KeplerOps/coronagraph:*`
- **S3 state bucket** with random suffix to prevent cost attacks

| Environment | Account | State Bucket |
|-------------|---------|-------------|
| Dev | catalyst-dev (516608939870) | `keplerops-coronagraph-tfstate-dev-d2335c02` |
| Prod | catalyst-prod (410247952697) | `keplerops-coronagraph-tfstate-prod-d2335c02` |

Initialize Terraform with the appropriate backend:

```bash
terraform init -backend-config=backend-dev.hcl   # Dev
terraform init -backend-config=backend-prod.hcl  # Prod
```
