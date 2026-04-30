/**
 * Monorepo detection utilities.
 *
 * Discovers monorepos in the workspace root and detects their
 * ecosystem types by checking for config files (package.json,
 * composer.json, app.json, etc.).
 *
 * @module utils/detect
 * @since 0.1.0
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Ecosystem, MonorepoInfo } from "../types/index.js";

/**
 * Find the workspace root directory.
 *
 * Walks up from the current directory looking for a directory
 * that contains multiple monorepo subdirectories (each with .git).
 * Falls back to cwd if no parent workspace is found.
 *
 * @returns Absolute path to the workspace root
 */
export function findWorkspaceRoot(): string {
  let dir = process.cwd();

  // If we're inside a monorepo, go up one level
  if (
    existsSync(join(dir, "turbo.json")) &&
    existsSync(join(dir, "package.json"))
  ) {
    const parent = resolve(dir, "..");
    const siblings = readdirSync(parent).filter((entry) => {
      const entryPath = join(parent, entry);
      return (
        statSync(entryPath).isDirectory() && existsSync(join(entryPath, ".git"))
      );
    });

    if (siblings.length > 1) {
      return parent;
    }
  }

  return dir;
}

/**
 * Detect the ecosystem types of a monorepo.
 *
 * Checks for the presence of ecosystem-specific config files:
 * - `package.json` → node
 * - `composer.json` → php
 * - `app.json` in apps/ → react-native
 * - `pyproject.toml` or `requirements.txt` → python
 *
 * @param repoPath - Absolute path to the monorepo root
 * @returns Array of detected ecosystem types
 */
export function detectEcosystems(repoPath: string): Ecosystem[] {
  const ecosystems: Ecosystem[] = [];

  // Node / TypeScript
  if (existsSync(join(repoPath, "package.json"))) {
    ecosystems.push("node");
  }

  // PHP / Laravel
  if (existsSync(join(repoPath, "composer.json"))) {
    ecosystems.push("php");
  }

  // React Native (check for expo in package.json or app.json in apps/)
  if (existsSync(join(repoPath, "package.json"))) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(repoPath, "package.json"), "utf8"),
      );
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps["expo"] || allDeps["react-native"]) {
        ecosystems.push("react-native");
      }
    } catch {
      /* ignore parse errors */
    }

    // Also check for app.json in apps/
    if (existsSync(join(repoPath, "apps"))) {
      try {
        const apps = readdirSync(join(repoPath, "apps"));
        for (const app of apps) {
          if (existsSync(join(repoPath, "apps", app, "app.json"))) {
            if (!ecosystems.includes("react-native")) {
              ecosystems.push("react-native");
            }
            break;
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  // Python
  if (
    existsSync(join(repoPath, "pyproject.toml")) ||
    existsSync(join(repoPath, "requirements.txt"))
  ) {
    ecosystems.push("python");
  }

  return ecosystems;
}

/**
 * Read workspace globs from pnpm-workspace.yaml.
 *
 * @param repoPath - Absolute path to the monorepo root
 * @returns Array of workspace glob patterns
 */
export function readWorkspaceGlobs(repoPath: string): string[] {
  const wsFile = join(repoPath, "pnpm-workspace.yaml");
  if (!existsSync(wsFile)) return [];

  try {
    const content = readFileSync(wsFile, "utf8");
    const globs: string[] = [];

    // Simple YAML parser for the packages array
    const lines = content.split("\n");
    let inPackages = false;

    for (const line of lines) {
      if (line.trim() === "packages:") {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        const match = line.match(/^\s+-\s+['"]?([^'"]+)['"]?\s*$/);
        if (match) {
          globs.push(match[1]);
        } else if (
          line.trim() &&
          !line.startsWith("#") &&
          !line.startsWith(" ")
        ) {
          break; // End of packages section
        }
      }
    }

    return globs;
  } catch {
    return [];
  }
}

/**
 * Discover all monorepos in the workspace root.
 *
 * Scans the workspace root for directories that contain
 * a `.git` directory and at least one ecosystem config file.
 *
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns Array of discovered monorepo info objects
 */
export function discoverMonorepos(workspaceRoot: string): MonorepoInfo[] {
  const repos: MonorepoInfo[] = [];

  const entries = readdirSync(workspaceRoot).filter((entry) => {
    const entryPath = join(workspaceRoot, entry);
    return (
      statSync(entryPath).isDirectory() &&
      !entry.startsWith(".") &&
      !entry.startsWith("node_modules") &&
      existsSync(join(entryPath, ".git"))
    );
  });

  for (const entry of entries) {
    const repoPath = join(workspaceRoot, entry);
    const ecosystems = detectEcosystems(repoPath);

    if (ecosystems.length === 0) continue;

    repos.push({
      name: entry,
      path: repoPath,
      ecosystems,
      workspaces: readWorkspaceGlobs(repoPath),
      hasTurbo: existsSync(join(repoPath, "turbo.json")),
      hasGit: true,
    });
  }

  return repos.sort((a, b) => a.name.localeCompare(b.name));
}
