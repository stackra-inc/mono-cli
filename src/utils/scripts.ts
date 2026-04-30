/**
 * Script discovery utilities.
 *
 * Scans monorepo package.json files to discover available
 * npm/pnpm scripts. Used by the RunCommand to show available
 * tasks and provide interactive selection.
 *
 * @module utils/scripts
 * @since 1.0.0
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MonorepoInfo } from '@/types';

/**
 * Represents a discovered script from a monorepo's package.json.
 */
export interface DiscoveredScript {
  /** Script name (e.g., 'build', 'lint:fix') */
  name: string;
  /** The shell command the script runs */
  command: string;
  /** Which monorepo this script belongs to */
  repo: string;
  /** Whether this script is a turbo task (runs via turbo) */
  isTurbo: boolean;
}

/**
 * Scan a monorepo's root package.json for available scripts.
 *
 * @param repo - The monorepo info object
 * @returns Array of discovered scripts
 */
export function discoverScripts(repo: MonorepoInfo): DiscoveredScript[] {
  try {
    const pkgPath = join(repo.path, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const scripts: Record<string, string> = pkg.scripts || {};

    return Object.entries(scripts).map(([name, command]) => ({
      name,
      command,
      repo: repo.name,
      isTurbo: command.includes('turbo'),
    }));
  } catch {
    return [];
  }
}

/**
 * Scan all monorepos and collect unique script names.
 *
 * Groups scripts by name across repos, showing which repos
 * have each script available.
 *
 * @param repos - Array of monorepo info objects
 * @returns Map of script name → array of repo names that have it
 */
export function collectScriptMap(repos: MonorepoInfo[]): Map<string, string[]> {
  const scriptMap = new Map<string, string[]>();

  for (const repo of repos) {
    const scripts = discoverScripts(repo);

    for (const script of scripts) {
      const existing = scriptMap.get(script.name) || [];
      existing.push(repo.name);
      scriptMap.set(script.name, existing);
    }
  }

  return scriptMap;
}

/**
 * Get scripts that are common across all (or most) repos.
 * These are the ones that make sense to run via `mono run <task>`.
 *
 * @param repos - Array of monorepo info objects
 * @param minRepos - Minimum number of repos that must have the script (default: 1)
 * @returns Array of script names sorted by frequency
 */
export function getCommonScripts(repos: MonorepoInfo[], minRepos: number = 1): string[] {
  const scriptMap = collectScriptMap(repos);

  return [...scriptMap.entries()]
    .filter(([, repoNames]) => repoNames.length >= minRepos)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name]) => name);
}
