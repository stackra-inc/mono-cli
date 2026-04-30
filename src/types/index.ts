/**
 * Core type definitions for @stackra/mono-cli.
 *
 * Defines the monorepo ecosystem types, workspace structures,
 * and configuration interfaces used throughout the CLI.
 *
 * @module types
 * @since 0.1.0
 */

// ============================================================================
// Ecosystem & Detection
// ============================================================================

/**
 * Supported monorepo ecosystem types.
 * The CLI auto-detects these based on root config files.
 */
export type Ecosystem = "node" | "php" | "react-native" | "python";

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
