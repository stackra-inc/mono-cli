/**
 * Core type definitions for @stackra/mono-cli.
 *
 * Defines the monorepo ecosystem types, workspace structures,
 * and configuration interfaces used throughout the CLI.
 *
 * @module types
 * @since 1.0.0
 */

// ============================================================================
// Ecosystem & Detection
// ============================================================================

/**
 * Supported monorepo ecosystem types.
 * The CLI auto-detects these based on root config files.
 */
export type Ecosystem = "node" | "php" | "react-native" | "python" | "go";

/**
 * Cleanup modes supported by the universal cleanup command.
 */
export type CleanMode = "build" | "cache" | "deps" | "tmp" | "all";

// ============================================================================
// Monorepo & Workspace
// ============================================================================

/**
 * Represents a discovered monorepo in the workspace.
 */
export interface MonorepoInfo {
  /** Display name (directory name) */
  name: string;
  /** Absolute path to the monorepo root */
  path: string;
  /** Detected ecosystems (a repo can be multi-ecosystem) */
  ecosystems: Ecosystem[];
  /** Workspace package globs (from pnpm-workspace.yaml) */
  workspaces: string[];
  /** Whether the repo has a turbo.json */
  hasTurbo: boolean;
  /** Whether the repo has a .git directory */
  hasGit: boolean;
}

/**
 * Represents a single workspace package within a monorepo.
 */
export interface WorkspacePackage {
  /** Package name from package.json or composer.json */
  name: string;
  /** Relative path from monorepo root */
  relativePath: string;
  /** Absolute path */
  absolutePath: string;
  /** Package version */
  version: string;
  /** Whether it's private (not published) */
  isPrivate: boolean;
  /** Ecosystem of this specific package */
  ecosystem: Ecosystem;
}

// ============================================================================
// Command Execution
// ============================================================================

/**
 * Result of running a command in a single monorepo.
 */
export interface CommandResult {
  /** Monorepo name */
  repo: string;
  /** Whether the command succeeded */
  success: boolean;
  /** stdout output */
  stdout: string;
  /** stderr output */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Duration in milliseconds */
  duration: number;
}

// ============================================================================
// Global CLI Options
// ============================================================================

/**
 * Global options available on every command.
 * Parsed from CLI flags like --json, --no-interactive, --repo.
 */
export interface GlobalOptions {
  /** Output results as JSON (for piping / CI) */
  json: boolean;
  /** Disable interactive prompts (for CI / scripts) */
  interactive: boolean;
  /** Target specific repo(s) instead of all */
  repo?: string[];
  /** Enable verbose/debug output */
  verbose: boolean;
}

// ============================================================================
// Scaffold
// ============================================================================

/**
 * Options for the scaffold/create command.
 */
export interface ScaffoldOptions {
  /** Target monorepo name */
  repo: string;
  /** Package category (e.g., 'base', 'tools', 'modules/ab') */
  category: string;
  /** Package name (e.g., 'my-package') */
  name: string;
  /** Package description */
  description?: string;
  /** Ecosystem type */
  ecosystem: Ecosystem;
}

// ============================================================================
// Module System (CliModule)
// ============================================================================

/**
 * A custom command registered by a monorepo via mono.config.ts.
 */
export interface CustomCommand {
  /** Command name (used as `mono <repo>:<name>`) */
  name: string;
  /** Human-readable description */
  description: string;
  /** The shell command to execute, or an async function */
  action: string | (() => Promise<void>);
  /** Optional aliases */
  aliases?: string[];
  /** Optional emoji prefix for display */
  emoji?: string;
}

/**
 * Configuration exported from a monorepo's mono.config.ts.
 */
export interface MonoConfig {
  /** Monorepo display name */
  name: string;
  /** Custom commands registered by this monorepo */
  commands: CustomCommand[];
  /** Optional description */
  description?: string;
}

// ============================================================================
// Platform Command Mapping
// ============================================================================

/**
 * Maps generic task names to ecosystem-specific commands.
 * Used by the turbo proxy to translate `mono build` into
 * the correct command for each ecosystem.
 */
export interface PlatformCommands {
  /** Install dependencies */
  install: string;
  /** Build the project */
  build: string;
  /** Run tests */
  test: string;
  /** Run linter */
  lint: string;
  /** Fix lint issues */
  "lint:fix": string;
  /** Format code */
  format: string;
  /** Start dev server */
  dev: string;
  /** Clean artifacts */
  clean: string;
  /** Additional platform-specific commands */
  [key: string]: string;
}

// ============================================================================
// Secret Management
// ============================================================================

/**
 * A stored secret entry.
 */
export interface SecretEntry {
  /** Secret key name (e.g., NPM_TOKEN) */
  key: string;
  /** Display label (e.g., "npm - personal") */
  label: string;
  /** The secret value (encrypted at rest) */
  value: string;
  /** Whether this is the default for its key */
  isDefault: boolean;
  /** When the secret was stored */
  createdAt: string;
  /** Source of the secret (manual, gh-cli, glab-cli) */
  source: "manual" | "gh-cli" | "glab-cli";
}
