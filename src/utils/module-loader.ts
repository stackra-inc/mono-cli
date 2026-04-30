/**
 * Module loader — discovers and loads mono.config.ts files.
 *
 * Scans each discovered monorepo for a `mono.config.ts` or
 * `mono.config.js` file and dynamically imports it to load
 * custom command registrations.
 *
 * @module utils/module-loader
 * @since 1.0.0
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MonoConfig, MonorepoInfo } from '@/types';

/** Supported config file names in priority order. */
const CONFIG_FILES = ['mono.config.ts', 'mono.config.js'] as const;

/**
 * Result of loading a monorepo's config file.
 */
export interface LoadedConfig {
  /** The monorepo this config belongs to */
  repo: MonorepoInfo;
  /** The loaded configuration */
  config: MonoConfig;
}

/**
 * Discover and load mono.config.ts files from each monorepo.
 *
 * Iterates over all discovered monorepos, checks for a config file,
 * and dynamically imports it. Repos without a config file are silently
 * skipped. Import errors are caught and logged to stderr.
 *
 * @param repos - Array of discovered monorepo info objects
 * @returns Array of successfully loaded configs
 */
export async function loadMonoConfigs(repos: MonorepoInfo[]): Promise<LoadedConfig[]> {
  const loaded: LoadedConfig[] = [];

  for (const repo of repos) {
    const config = await loadSingleConfig(repo);
    if (config) {
      loaded.push({ repo, config });
    }
  }

  return loaded;
}

/**
 * Load a single monorepo's config file.
 *
 * Checks for `mono.config.ts` then `mono.config.js` in the repo root.
 * Uses dynamic import to load the config module.
 *
 * @param repo - Monorepo info object
 * @returns The loaded config, or null if not found or errored
 */
async function loadSingleConfig(repo: MonorepoInfo): Promise<MonoConfig | null> {
  for (const filename of CONFIG_FILES) {
    const configPath = join(repo.path, filename);

    if (!existsSync(configPath)) continue;

    try {
      const fileUrl = pathToFileURL(configPath).href;
      const mod = await import(fileUrl);
      const config = mod.default ?? mod;

      // Validate the loaded config has the expected shape
      if (isValidConfig(config)) {
        return config;
      }

      console.error(`[mono] Invalid config in ${repo.name}/${filename} — skipping`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[mono] Failed to load ${repo.name}/${filename}: ${message}`);
    }

    break; // Only try the first matching file
  }

  return null;
}

/**
 * Validate that a loaded module export matches the MonoConfig shape.
 *
 * @param value - The imported value to validate
 * @returns True if the value is a valid MonoConfig
 */
function isValidConfig(value: unknown): value is MonoConfig {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;
  return typeof obj.name === 'string' && Array.isArray(obj.commands);
}
