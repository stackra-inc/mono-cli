/**
 * Module loader — discovers and loads mono.config.ts files.
 *
 * Uses `jiti` to transpile TypeScript config files on the fly,
 * just like Next.js does with `next.config.ts`. This avoids
 * Node.js MODULE_TYPELESS_PACKAGE_JSON warnings and supports
 * `.ts`, `.mjs`, and `.js` config files.
 *
 * @module utils/module-loader
 * @since 1.0.0
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import type { MonoConfig, MonorepoInfo } from '@/types';

/** Supported config file names in priority order. */
const CONFIG_FILES = ['mono.config.ts', 'mono.config.mjs', 'mono.config.js'] as const;

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
 * Discover and load mono.config files from each monorepo.
 *
 * Iterates over all discovered monorepos, checks for a config file,
 * and loads it via jiti (TypeScript-aware). Repos without a config
 * file are silently skipped.
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
 * Load a single monorepo's config file using jiti.
 *
 * jiti transpiles TypeScript on the fly — same approach as
 * Next.js for next.config.ts. No Node.js warnings, no
 * "type": "module" requirement.
 *
 * @param repo - Monorepo info object
 * @returns The loaded config, or null if not found or errored
 */
async function loadSingleConfig(repo: MonorepoInfo): Promise<MonoConfig | null> {
  for (const filename of CONFIG_FILES) {
    const configPath = join(repo.path, filename);

    if (!existsSync(configPath)) continue;

    try {
      // Create a jiti instance rooted at the repo directory
      const jiti = createJiti(repo.path, {
        interopDefault: true,
      });

      // Load the config file — jiti handles TS transpilation
      const mod = await jiti.import(configPath);
      const config = (mod as Record<string, unknown>).default ?? mod;

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
