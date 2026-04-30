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
mono git status                   # multi-repo git status
mono git push [message]           # commit + push all
mono graph [--format]             # dependency graphs
mono format [--check]             # prettier across repos
mono create <app|package> [name]  # scaffold new app/package
mono secret set <key> [value]     # store secrets
mono secret list                  # list stored secrets
mono secret use <key>             # set default secret
mono about                        # CLI info + registered commands
mono <repo>:<command>             # proxy to repo-specific commands
```

## Module System

Each monorepo can register custom commands by placing a `mono.config.ts` file
at its root:

```typescript
// frontend-monorepo/mono.config.ts
import { CliModule } from "@stackra/mono-cli";

export default CliModule.register({
  name: "frontend",
  commands: [
    {
      name: "storybook",
      description: "Start Storybook dev server",
      action: () => "pnpm storybook",
    },
    {
      name: "deploy:preview",
      description: "Deploy to Vercel preview",
      action: () => "vercel deploy",
    },
  ],
});
```

These commands become available as `mono frontend:storybook`, etc.

## Secret Management

Secrets are stored in `~/.stackra/secrets.json` (encrypted) and can be
referenced by name:

```bash
mono secret set NPM_TOKEN <token>           # store a secret
mono secret set GITHUB_TOKEN --from-gh      # import from gh cli
mono secret list                             # list all secrets
mono secret use NPM_TOKEN --default         # set as default
```

## Platform Command Mapping

Each ecosystem maps generic commands to platform-specific ones:

```typescript
const platformCommands = {
  node: {
    install: "pnpm install",
    build: "pnpm turbo run build",
    test: "pnpm turbo run test",
    lint: "pnpm turbo run lint",
    format: "pnpm prettier --write .",
  },
  php: {
    install: "composer install",
    build: "pnpm turbo run build",
    test: "pnpm turbo run test",
    lint: "pnpm turbo run lint",
    format: "pnpm prettier --write . && ./vendor/bin/pint",
  },
  go: {
    install: "go mod download",
    build: "go build ./...",
    test: "go test ./...",
    lint: "golangci-lint run",
    format: "gofmt -w .",
  },
};
```

## ASCII Banner

The CLI displays a gradient ASCII banner on `mono about` and `mono --version`:

```
 ███████╗████████╗ █████╗  ██████╗██╗  ██╗██████╗  █████╗
 ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██╔══██╗
 ███████╗   ██║   ███████║██║     █████╔╝ ██████╔╝███████║
 ╚════██║   ██║   ██╔══██║██║     ██╔═██╗ ██╔══██╗██╔══██║
 ███████║   ██║   ██║  ██║╚██████╗██║  ██╗██║  ██║██║  ██║
 ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝
```

## Implementation Phases

### Phase 1 — Core (current)

- [x] Auto-detection of monorepos and ecosystems
- [x] Status command with table output
- [x] Clean command (universal cleanup)
- [x] Run command (turbo proxy)
- [x] Git status + push
- [x] Graph generation
- [x] --json, --no-interactive, --repo flags
- [x] @clack/prompts for interactive UI

### Phase 2 — Extensibility

- [ ] CliModule.register() for custom commands
- [ ] mono.config.ts discovery in each monorepo
- [ ] `mono about` with registered commands
- [ ] Platform command mapping
- [ ] ASCII banner with gradient

### Phase 3 — Scaffolding

- [ ] `mono create app` — interactive app scaffolding
- [ ] `mono create package` — interactive package scaffolding
- [ ] Template system for each ecosystem
- [ ] Vite/Laravel/Expo CLI integration

### Phase 4 — Secrets & Config

- [ ] `mono secret set/get/list/use`
- [ ] Encrypted storage in ~/.stackra/
- [ ] gh/glab CLI integration for token import
- [ ] Multi-user/multi-token support

### Phase 5 — Advanced

- [ ] `mono publish` — publish packages to npm/packagist
- [ ] `mono sync` — sync configs across repos
- [ ] `mono upgrade` — upgrade dependencies across repos
- [ ] Turbo remote caching setup
