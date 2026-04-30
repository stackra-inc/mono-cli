# @stackra/mono-cli

## 1.0.0 — 2026-04-30

### Added

- 🏗️ **Class-based DI architecture** — commands are `@Injectable()` classes
  extending `BaseCommand`, registered via `@Command()` decorator
- 📦 **@stackra/ts-container** — uses published DI container for dependency
  injection (no custom container)
- 🎨 **ASCII banner** — randomized gradient themes on `mono about`
- 📊 **StatusCommand** — workspace overview with git status
- 🧹 **CleanCommand** — universal cleanup with interactive mode picker
- 🔨 **BuildCommand** — turbo build proxy across repos
- ▶️ **RunCommand** — generic turbo task proxy with interactive script picker
- ✨ **FormatCommand** — prettier across repos
- 📊 **GitStatusCommand** — git status across all repos
- 📤 **GitPushCommand** — commit and push across repos
- 🕸️ **GraphCommand** — dependency graph generation (dot, json, html)
- 🏗️ **CreateCommand** — interactive app/package scaffolding (Vite, Next.js,
  Expo, Laravel)
- 🔐 **SecretCommand** — manage secrets in ~/.stackra/secrets.json (set, get,
  list, delete, use, --from-gh, --from-glab)
- 📦 **PublishCommand** — detect changed packages, build, publish to npm
- 🔄 **SyncCommand** — sync configs, composer path repos, turbo deps across repos
- ⬆️ **UpgradeCommand** — upgrade dependencies (pnpm update or ncu -u)
- ℹ️ **AboutCommand** — CLI info, registered commands, flags
- 🔌 **CliModule.register()** — custom commands via mono.config.ts in each repo
- 🌐 **Ecosystem detection** — Node, PHP, React Native, Python, Go
- 🎛️ **Global flags** — `--json`, `--no-interactive`, `--repo`, `--verbose`
- 📋 **Script discovery** — scans package.json scripts for interactive picker
- 🔧 **CI/CD** — GitHub Actions for typecheck, build, test, lint, format, publish
- 📦 **Dependabot** — auto-update dependencies

### Fixed

- 🔧 **Engines** — standardized to `node>=22`, `pnpm>=10`
- 🔧 **ESLint** — pinned to v9 with jiti for TS config loading

## 0.1.0 — 2026-04-30

### Added

- Initial release
- Auto-detection of monorepos and ecosystems (Node, PHP, React Native, Python)
- Status, clean, build, about commands
- @clack/prompts for interactive UI
- chalk for colored output
- cli-table3 for table formatting
