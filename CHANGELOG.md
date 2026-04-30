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
- ℹ️ **AboutCommand** — CLI info, registered commands, flags
- 🌐 **Go ecosystem** — auto-detection via `go.mod`
- 🎛️ **Global flags** — `--json`, `--no-interactive`, `--repo`, `--verbose`
- 📋 **Platform command mapping** — ecosystem-specific command translations
- 🏷️ **@Command() decorator** — metadata (name, description, emoji, category,
  aliases, args)
- 📐 **Architecture steering file** — blueprint for CLI design and phases
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
