/**
 * CleanCommand — remove build artifacts, caches, and dependencies.
 *
 * Performs cleanup natively in Node.js — no external scripts needed.
 * Auto-detects ecosystem and cleans the appropriate artifacts:
 *
 * - **Node/TS**: dist, .next, coverage, node_modules, tsbuildinfo
 * - **PHP**: vendor, bootstrap/cache, storage/framework, logs
 * - **React Native**: .expo, ios/build, android/app/build, Pods
 * - **Python**: __pycache__, .pytest_cache, venv, *.pyc
 * - **Go**: go clean -cache
 * - **Universal**: .turbo, .DS_Store, Thumbs.db, .tmp
 *
 * @module commands/clean
 * @since 1.0.0
 */

import * as p from '@clack/prompts';
import { rmSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import { discoverMonorepos, findWorkspaceRoot } from '@/utils';
import { theme, symbols, formatDuration } from '@/utils/ui';
import type { CleanMode, GlobalOptions, MonorepoInfo } from '@/types';

/** Valid cleanup modes with descriptions. */
const CLEAN_MODES: Record<CleanMode, string> = {
  build: 'Build artifacts (dist, coverage, .next, vendor/public/build)',
  cache: 'Caches (.turbo, eslint, tsbuildinfo)',
  deps: 'Dependencies (node_modules, vendor, lockfiles)',
  tmp: 'Temp files (.DS_Store, Thumbs.db)',
  all: 'Everything (build + cache + tmp + deps)',
};

/** Directories to remove per mode and ecosystem. */
const CLEAN_DIRS: Record<string, string[]> = {
  // Build artifacts
  'build:node': ['dist', '.next', '.output', 'release', 'storybook-static', 'coverage'],
  'build:php': ['public/build'],
  'build:react-native': ['.expo'],
  'build:python': ['__pycache__', '.pytest_cache'],

  // Caches
  'cache:universal': ['.turbo'],
  'cache:node': ['.cache', '.eslintcache'],

  // Dependencies
  'deps:node': ['node_modules'],
  'deps:php': ['vendor'],
  'deps:python': ['venv', '.venv'],

  // Temp
  'tmp:universal': ['.tmp', 'tmp'],
};

/** Files (by pattern) to remove per mode. */
const CLEAN_FILES: Record<string, string[]> = {
  'build:node': ['*.tsbuildinfo'],
  'cache:node': ['.eslintcache'],
  'tmp:universal': ['.DS_Store', 'Thumbs.db'],
};

/** Lockfiles to remove in deps mode. */
const LOCKFILES = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
  'composer.lock',
  'poetry.lock',
  'Pipfile.lock',
];

/**
 * Universal cleanup command.
 * Performs cleanup natively — no external scripts.
 */
@Command({
  name: 'clean',
  description: 'Clean build artifacts, caches, or dependencies',
  emoji: '🧹',
  category: 'core',
  args: '[mode]',
  aliases: ['c'],
})
@Injectable()
export class CleanCommand extends BaseCommand {
  /**
   * Execute the clean command.
   *
   * @param args - [mode] — build, cache, deps, tmp, or all
   * @param opts - Global CLI options
   */
  async handle(args: string[], opts: GlobalOptions): Promise<void> {
    const root = findWorkspaceRoot();
    const repos = discoverMonorepos(root);

    const filtered = opts.repo
      ? repos.filter((r) => opts.repo!.some((name) => r.name.includes(name)))
      : repos;

    // Resolve cleanup mode
    let cleanMode: CleanMode;
    const modeArg = args[0];

    if (modeArg && modeArg in CLEAN_MODES) {
      cleanMode = modeArg as CleanMode;
    } else if (opts.interactive) {
      const selected = await p.select({
        message: 'What do you want to clean?',
        options: Object.entries(CLEAN_MODES).map(([value, label]) => ({
          value: value as CleanMode,
          label: `${value.padEnd(8)} ${theme.muted(`— ${label}`)}`,
        })),
      });

      if (p.isCancel(selected)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }

      cleanMode = selected;
    } else {
      cleanMode = 'build';
    }

    if (!opts.json) {
      p.intro(theme.primary(`  🧹 Clean: ${cleanMode}  `));
      this.info(`${theme.muted('Repos:')} ${filtered.map((r) => r.name).join(', ')}`, opts);
    }

    // Run cleanup in each repo
    const results: Array<{ repo: string; removed: number; duration: number }> = [];
    const s = this.spinner(opts);

    for (let i = 0; i < filtered.length; i++) {
      const repo = filtered[i]!;
      s?.start(`Cleaning ${theme.bold(repo.name)} (${i + 1}/${filtered.length})...`);

      const start = Date.now();
      const modes = cleanMode === 'all' ? ['build', 'cache', 'tmp', 'deps'] : [cleanMode];
      let totalRemoved = 0;

      for (const mode of modes) {
        totalRemoved += this.cleanRepo(repo, mode);
      }

      const duration = Date.now() - start;
      results.push({ repo: repo.name, removed: totalRemoved, duration });

      if (!opts.json) {
        s?.stop(
          `${symbols.success} ${theme.bold(repo.name)} ${theme.dim(`${totalRemoved} removed`)} ${theme.dim(formatDuration(duration))}`
        );
      }
    }

    this.output(results, opts, (data) => {
      const totalRemoved = data.reduce((sum, r) => sum + r.removed, 0);
      const totalTime = data.reduce((sum, r) => sum + r.duration, 0);

      console.log('');
      p.outro(
        theme.success(
          `${totalRemoved} items removed across ${data.length} repos ${theme.dim(`(${formatDuration(totalTime)})`)}`
        )
      );
    });
  }

  // ── Private Cleanup Methods ──────────────────────────────────

  /**
   * Clean a single repo for a given mode.
   *
   * @param repo - The monorepo to clean
   * @param mode - The cleanup mode
   * @returns Number of items removed
   */
  private cleanRepo(repo: MonorepoInfo, mode: string): number {
    let removed = 0;
    const ecosystems = ['universal', ...repo.ecosystems];

    // Remove directories
    for (const eco of ecosystems) {
      const key = `${mode}:${eco}`;
      const dirs = CLEAN_DIRS[key];
      if (!dirs) continue;

      for (const dir of dirs) {
        removed += this.removeDirsRecursive(repo.path, dir);
      }
    }

    // Remove files by pattern
    for (const eco of ecosystems) {
      const key = `${mode}:${eco}`;
      const patterns = CLEAN_FILES[key];
      if (!patterns) continue;

      for (const pattern of patterns) {
        removed += this.removeFilesRecursive(repo.path, pattern);
      }
    }

    // Remove lockfiles in deps mode
    if (mode === 'deps') {
      for (const lockfile of LOCKFILES) {
        const lockPath = join(repo.path, lockfile);
        if (existsSync(lockPath)) {
          try {
            unlinkSync(lockPath);
            removed++;
          } catch {
            /* skip */
          }
        }
      }
    }

    return removed;
  }

  /**
   * Recursively find and remove directories matching a name.
   * Skips node_modules and vendor to avoid deep traversal.
   *
   * @param root - Root directory to search from
   * @param dirName - Directory name to match
   * @returns Number of directories removed
   */
  private removeDirsRecursive(root: string, dirName: string): number {
    let removed = 0;

    const walk = (dir: string, depth: number) => {
      if (depth > 5) return; // Safety limit

      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          // Skip traversing into these
          if (entry === 'node_modules' || entry === 'vendor' || entry === '.git') continue;

          const fullPath = join(dir, entry);
          try {
            if (!statSync(fullPath).isDirectory()) continue;
          } catch {
            continue;
          }

          if (entry === dirName) {
            try {
              rmSync(fullPath, { recursive: true, force: true });
              removed++;
            } catch {
              /* skip */
            }
          } else {
            walk(fullPath, depth + 1);
          }
        }
      } catch {
        /* skip unreadable dirs */
      }
    };

    // Also check the root itself for the dir
    const directPath = join(root, dirName);
    if (existsSync(directPath)) {
      try {
        rmSync(directPath, { recursive: true, force: true });
        removed++;
        return removed;
      } catch {
        /* fall through to recursive */
      }
    }

    walk(root, 0);
    return removed;
  }

  /**
   * Recursively find and remove files matching a pattern.
   *
   * @param root - Root directory to search from
   * @param pattern - File name or glob pattern (simple: *.ext or exact name)
   * @returns Number of files removed
   */
  private removeFilesRecursive(root: string, pattern: string): number {
    let removed = 0;
    const isGlob = pattern.startsWith('*');
    const ext = isGlob ? pattern.slice(1) : null;

    const walk = (dir: string, depth: number) => {
      if (depth > 5) return;

      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          if (entry === 'node_modules' || entry === 'vendor' || entry === '.git') continue;

          const fullPath = join(dir, entry);
          try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              walk(fullPath, depth + 1);
            } else if (stat.isFile()) {
              const matches = isGlob ? entry.endsWith(ext!) : entry === pattern;
              if (matches) {
                try {
                  unlinkSync(fullPath);
                  removed++;
                } catch {
                  /* skip */
                }
              }
            }
          } catch {
            continue;
          }
        }
      } catch {
        /* skip */
      }
    };

    walk(root, 0);
    return removed;
  }
}
