# @stackra/mono-cli

Universal CLI for managing Stackra monorepos — clean, build, lint, scaffold, and
publish across all ecosystems from a single command.

## Install

```bash
pnpm add -g @stackra/mono-cli
```

## Usage

```bash
# Show workspace status (default command)
mono

# Clean across all repos
mono clean build          # build artifacts
mono clean all            # everything

# Run turbo tasks
mono build                # build all repos
mono lint                 # lint all repos
mono test                 # test all repos
mono run <task>           # any turbo task

# Git operations
mono git status           # status across all repos
mono git push "message"   # commit + push all repos

# Dependency graphs
mono graph                # HTML graph
mono graph -f mermaid     # Mermaid diagram

# Format
mono format               # prettier write
mono format --check       # prettier check
```

## Global Flags

| Flag                | Description                    |
| ------------------- | ------------------------------ |
| `--json`            | Output as JSON (for CI/piping) |
| `--no-interactive`  | Disable prompts (for CI)       |
| `-r, --repo <name>` | Target specific repo(s)        |
| `--verbose`         | Show detailed output           |
| `-v, --version`     | Show version                   |

## Auto-Detection

The CLI auto-detects monorepo types:

- **Node/TS** — `package.json` present
- **PHP** — `composer.json` present
- **React Native** — `expo` or `app.json` detected
- **Python** — `pyproject.toml` or `requirements.txt` present

## License

[MIT](./LICENSE) © Stackra L.L.C
