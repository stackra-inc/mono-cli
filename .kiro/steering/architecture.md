---
inclusion: auto
---

# @stackra/mono-cli — Architecture Blueprint

## Overview

A full-fledged, extensible CLI for managing Stackra monorepos across all
ecosystems. Built on a modular architecture where each monorepo can register
custom commands, and the core provides universal operations.

## Core Principles

1. **Turbo-first** — Every task execution goes through turbo for caching,
   parallelism, and dependency ordering
2. **Ecosystem-aware** — Auto-detects Node, PHP, React Native, Python, Go and
   adapts behavior
3. **Extensible** — Monorepos register custom commands via `CliModule.register()`
4. **Interactive + CI** — Beautiful interactive UI by default, `--json` and
   `--no-interactive` for CI
5. **DI-powered** — Uses `@stackra/ts-container` for dependency injection

## Ecosystem Support

| Ecosystem    | Detect By                 | Package Manager | Task Runner |
| ------------ | ------------------------- | --------------- | ----------- |
| Node/TS      | `package.json`            | pnpm            | turbo       |
| PHP/Laravel  | `composer.json`           | composer        | turbo       |
| React Native | `app.json` + expo/RN deps | pnpm            | turbo       |
| Python       | `pyproject.toml`          | pip/poetry      | turbo       |
| Go           | `go.mod`                  | go mod          | turbo       |

## Command Structure

```
mono                              # status (default)
mono status                       # workspace overview
mono clean [mode]                 # universal cleanup
mono run <task>                   # turbo run proxy
mono build / lint / test / dev    # turbo task shortcuts
mono git-status                   # multi-repo git status
mono git-push [message]           # commit + push all
mono graph [--format]             # dependency graphs
mono format [--check]             # prettier + pint across repos
mono create <app|package> [name]  # scaffold new app/package
mono secret <action> [key]        # manage stored secrets
mono publish [--dry-run]          # publish packages to npm
mono sync                         # sync configs across repos
mono upgrade [--interactive]      # upgrade dependencies
mono about                        # CLI info + registered commands
mono <repo>:<command>             # proxy to repo-specific commands
```

## Module System

Each monorepo can register custom commands by placing a `mono.config.ts` file
at its root:

```typescript
// frontend-monorepo/mono.config.ts
import { CliModule } from '@stackra/mono-cli';

export default CliModule.register({
  name: 'frontend',
  description: 'Frontend monorepo commands',
  commands: [
    {
      name: 'storybook',
      description: 'Start Storybook dev server',
      emoji: '📖',
      action: 'pnpm storybook',
    },
    {
      name: 'deploy:preview',
      description: 'Deploy to Vercel preview',
      emoji: '🚀',
      action: 'vercel deploy --prebuilt',
      aliases: ['dp'],
    },
  ],
});
```

These commands become available as `mono frontend:storybook`, etc.

## Secret Management

Secrets are stored in `~/.stackra/secrets.json` (base64-encoded) and can be
referenced by name. Supports multiple values per key with default selection.

```bash
mono secret set NPM_TOKEN <token>           # store a secret
mono secret set GITHUB_TOKEN --from-gh      # import from gh cli
mono secret set GLAB_TOKEN --from-glab      # import from glab cli
mono secret get NPM_TOKEN                   # retrieve default value
mono secret list                             # list all secrets
mono secret delete NPM_TOKEN                # remove all entries
mono secret use NPM_TOKEN --default         # set default entry
```

## Clean System

The CLI handles cleanup internally — no external `cleanup.sh` needed.
It reads ecosystem config files to determine what to clean:

- **Node/TS**: reads `tsconfig.json` → `outDir` for dist, plus standard
  `node_modules`, `.turbo`, `.next`, `coverage`, `*.tsbuildinfo`
- **PHP**: `vendor/`, `bootstrap/cache/`, `storage/framework/cache/`,
  `storage/framework/views/`, `storage/framework/sessions/`,
  `storage/logs/*.log`, `public/build/`
- **React Native**: `.expo/`, `ios/build/`, `android/app/build/`, `ios/Pods/`
- **Python**: `__pycache__/`, `.pytest_cache/`, `*.egg-info/`, `*.pyc`,
  `venv/`, `.venv/`
- **Go**: `go clean -cache`
- **Universal**: `.DS_Store`, `Thumbs.db`, `.tmp/`, `coverage/`

## Format System

The format command is ecosystem-aware:

- **Node/TS**: `prettier --write .`
- **PHP**: `prettier --write . && ./vendor/bin/pint` (Laravel Pint)
- **Python**: `ruff format .`
- **Go**: `gofmt -w .`

## Implementation Phases

### Phase 1 — Core ✅

- [x] Auto-detection of monorepos and ecosystems (Node, PHP, RN, Python, Go)
- [x] StatusCommand with table output and git status
- [x] CleanCommand (universal cleanup with interactive mode picker)
- [x] BuildCommand (turbo proxy)
- [x] RunCommand (generic turbo task proxy)
- [x] GitStatusCommand + GitPushCommand
- [x] GraphCommand (dot, json, html formats)
- [x] FormatCommand (prettier across repos)
- [x] --json, --no-interactive, --repo, --verbose flags
- [x] @clack/prompts for interactive UI
- [x] ASCII banner with gradient themes

### Phase 2 — Extensibility ✅

- [x] CliModule.register() for custom commands with validation
- [x] mono.config.ts discovery via module-loader.ts
- [x] Custom commands namespaced as `mono <repo>:<command>`
- [x] AboutCommand shows built-in + custom commands
- [x] Platform command mapping (ECOSYSTEM_EMOJI, TASK_EMOJI)
- [x] @Command() decorator with category, aliases, args, emoji

### Phase 3 — Scaffolding ✅

- [x] CreateCommand — interactive app/package scaffolding
- [x] Framework selection (Vite, Next.js, Expo, Laravel)
- [x] Target monorepo selection
- [x] Name validation (lowercase, hyphens only)

### Phase 4 — Secrets & Config ✅

- [x] SecretCommand — set, get, list, delete, use subcommands
- [x] SecretStore service — ~/.stackra/secrets.json storage
- [x] Base64 encoding for obfuscation
- [x] Multiple values per key with default selection
- [x] gh CLI token import (--from-gh)
- [x] glab CLI token import (--from-glab)
- [x] Interactive password prompt for manual entry

### Phase 5 — Advanced ✅

- [x] PublishCommand — detect changed packages, build, publish to npm
- [x] SyncCommand — sync .editorconfig, .prettierignore, engines across repos
- [x] UpgradeCommand — pnpm update --latest or ncu -u across repos
- [x] Turbo-first execution (all tasks go through turbo)
