/**
 * @stackra/mono-cli — Universal CLI for Stackra monorepos.
 *
 * Provides a single entry point for managing multiple monorepos:
 * - Clean build artifacts, caches, and dependencies
 * - Run turbo tasks (build, lint, test) across repos
 * - Git operations (status, commit, push) across repos
 * - Generate dependency graphs
 * - Scaffold new packages
 *
 * Supports interactive mode (default) and non-interactive mode
 * (--no-interactive, --json) for CI/CD pipelines.
 *
 * @packageDocumentation
 * @module @stackra/mono-cli
 * @since 0.1.0
 *
 * @example
 * ```bash
 * # Install globally
 * pnpm add -g @stackra/mono-cli
 *
 * # Or run directly
 * npx @stackra/mono-cli status
 *
 * # Common commands
 * mono                          # show workspace status
 * mono clean all                # clean everything
 * mono run build                # build all repos
 * mono git push "feat: update"  # commit + push all
 * mono graph --format=mermaid   # generate dependency graphs
 * ```
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { GlobalOptions } from "./types/index.js";
import {
  statusCommand,
  cleanCommand,
  runTaskCommand,
  gitStatusCommand,
  gitPushCommand,
  graphCommand,
} from "./commands/index.js";

// ============================================================================
// Version
// ============================================================================

/** Read version from package.json at build time. */
let version = "0.1.0";
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf8"),
  );
  version = pkg.version;
} catch {
  /* fallback to hardcoded version */
}

// ============================================================================
// CLI Program
// ============================================================================

const program = new Command();

program
  .name("mono")
  .description("Universal CLI for managing Stackra monorepos")
  .version(version, "-v, --version")
  .option("--json", "Output results as JSON", false)
  .option("--no-interactive", "Disable interactive prompts (for CI)")
  .option("-r, --repo <repos...>", "Target specific repo(s)")
  .option("--verbose", "Enable verbose output", false);

/**
 * Extract global options from the program.
 *
 * @returns Parsed global options
 */
function getGlobalOpts(): GlobalOptions {
  const opts = program.opts();
  return {
    json: opts.json ?? false,
    interactive: opts.interactive ?? true,
    repo: opts.repo,
    verbose: opts.verbose ?? false,
  };
}

// ── Default command: status ──────────────────────────────────────────

program
  .command("status", { isDefault: true })
  .description("Show workspace overview and git status")
  .action(() => statusCommand(getGlobalOpts()));

// ── Clean ────────────────────────────────────────────────────────────

program
  .command("clean [mode]")
  .description("Clean build artifacts, caches, or dependencies")
  .addHelpText(
    "after",
    `
Modes:
  build    Build artifacts (dist, coverage, vendor/public/build)
  cache    Caches (turbo, eslint, tsbuildinfo)
  deps     Dependencies (node_modules, vendor, lockfiles)
  tmp      Temp files (.DS_Store, Thumbs.db)
  all      Everything
`,
  )
  .action((mode) => cleanCommand(mode, getGlobalOpts()));

// ── Run (turbo tasks) ────────────────────────────────────────────────

program
  .command("run <task>")
  .description("Run a turbo task across monorepos (build, lint, test, etc.)")
  .argument("[args...]", "Additional arguments to pass to turbo")
  .action((task, args) => runTaskCommand(task, getGlobalOpts(), args));

// Shortcut aliases for common tasks
for (const task of ["build", "lint", "test", "dev", "typecheck"]) {
  program
    .command(task)
    .description(`Run \`turbo run ${task}\` across monorepos`)
    .action(() => runTaskCommand(task, getGlobalOpts()));
}

// ── Git ──────────────────────────────────────────────────────────────

const git = program
  .command("git")
  .description("Git operations across monorepos");

git
  .command("status")
  .description("Show git status across all repos")
  .action(() => gitStatusCommand(getGlobalOpts()));

git
  .command("push [message]")
  .description("Commit and push changes across repos")
  .action((message) => gitPushCommand(message, getGlobalOpts()));

// ── Graph ────────────────────────────────────────────────────────────

program
  .command("graph")
  .description("Generate dependency graphs")
  .option(
    "-f, --format <format>",
    "Output format (html, mermaid, json, dot)",
    "html",
  )
  .action((cmdOpts) => graphCommand(cmdOpts.format, getGlobalOpts()));

// ── Format ───────────────────────────────────────────────────────────

program
  .command("format")
  .description("Run prettier across monorepos")
  .option("--check", "Check formatting without writing", false)
  .action((cmdOpts) => {
    const task = cmdOpts.check ? "format:check" : "format";
    return runTaskCommand(task, getGlobalOpts());
  });

// ============================================================================
// Parse & Execute
// ============================================================================

program.parse();
