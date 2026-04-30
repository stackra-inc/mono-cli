/**
 * SyncCommand — sync configs, dependencies, and repositories across monorepos.
 *
 * Handles all synchronization tasks that were previously done by
 * individual scripts in each monorepo:
 *
 * - Shared config files (.editorconfig, .prettierignore)
 * - Engine constraints in package.json
 * - PHP composer path repositories (replaces ComposerScripts::reposSync)
 * - Turbo dependency graph (replaces sync-turbo-deps.js)
 * - pnpm workspace dependencies from composer.json
 *
 * @module commands/sync
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono sync                      # sync everything
 * mono sync -r php               # sync PHP monorepo only
 * mono sync --json               # JSON output for CI
 * mono sync --verbose            # show detailed file-by-file output
 * ```
 */

import * as p from '@clack/prompts';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import type { GlobalOptions, MonorepoInfo } from '@/types';
import { discoverMonorepos, findWorkspaceRoot } from '@/utils';
import { theme, symbols } from '@/utils/ui';

/** Files to sync across all monorepos. */
const SYNC_FILES = ['.editorconfig', '.prettierignore'] as const;

/** Engine constraints to enforce in package.json files. */
const ENGINES = {
  node: '>=22',
  pnpm: '>=10',
} as const;

/**
 * Sync command — syncs configs, deps, and repos across monorepos.
 *
 * Replaces:
 * - ComposerScripts::reposSync (PHP path repository registration)
 * - sync-turbo-deps.js (composer → package.json dependency sync)
 * - Manual config file copying
 */
@Command({
  name: 'sync',
  description: 'Sync configs, deps, and repositories across repos',
  emoji: '🔄',
  category: 'tools',
  aliases: ['s'],
})
@Injectable()
export class SyncCommand extends BaseCommand {
  /**
   * Execute the sync command.
   *
   * @param _args - Unused positional arguments
   * @param opts - Global CLI options
   */
  async handle(_args: string[], opts: GlobalOptions): Promise<void> {
    const root = findWorkspaceRoot();
    const repos = discoverMonorepos(root);

    const filtered = opts.repo
      ? repos.filter((r) => opts.repo!.some((name) => r.name.includes(name)))
      : repos;

    if (filtered.length === 0) {
      this.warn('No matching repos found.', opts);
      return;
    }

    if (!opts.json) {
      p.intro(theme.primary('  🔄 Sync  '));
      this.info(`${theme.muted('Repos:')} ${filtered.map((r) => r.name).join(', ')}`, opts);
    }

    const results: Array<{
      repo: string;
      synced: string[];
      errors: string[];
    }> = [];

    for (const repo of filtered) {
      const synced: string[] = [];
      const errors: string[] = [];

      // 1. Sync shared config files
      this.syncConfigFiles(root, repo, synced, errors);

      // 2. Update engines in package.json
      if (repo.ecosystems.includes('node')) {
        this.syncEngines(repo, synced, errors);
      }

      // 3. PHP: sync composer path repositories
      if (repo.ecosystems.includes('php')) {
        this.syncComposerRepos(repo, synced, errors);
      }

      // 4. PHP: sync composer deps → package.json for turbo ordering
      if (repo.ecosystems.includes('php') && repo.ecosystems.includes('node')) {
        this.syncTurboDeps(repo, synced, errors);
      }

      results.push({ repo: repo.name, synced, errors });

      if (!opts.json) {
        const icon = errors.length === 0 ? symbols.success : symbols.warning;
        console.log(
          `  ${icon} ${theme.bold(repo.name.padEnd(25))} ${theme.dim(`${synced.length} synced`)}${errors.length > 0 ? theme.error(` ${errors.length} errors`) : ''}`
        );

        if (opts.verbose) {
          for (const file of synced) {
            console.log(`    ${symbols.success} ${theme.dim(file)}`);
          }
          for (const err of errors) {
            console.log(`    ${symbols.error} ${theme.error(err)}`);
          }
        }
      }
    }

    this.output(results, opts, (data) => {
      const totalSynced = data.reduce((sum, r) => sum + r.synced.length, 0);
      const totalErrors = data.reduce((sum, r) => sum + r.errors.length, 0);

      console.log('');
      p.outro(
        totalErrors === 0
          ? theme.success(`${totalSynced} items synced across ${data.length} repos`)
          : theme.warning(
              `${totalSynced} synced, ${totalErrors} errors across ${data.length} repos`
            )
      );
    });
  }

  // ── Private Sync Methods ─────────────────────────────────────

  /**
   * Copy shared config files from workspace root to each repo.
   */
  private syncConfigFiles(
    root: string,
    repo: MonorepoInfo,
    synced: string[],
    errors: string[]
  ): void {
    for (const file of SYNC_FILES) {
      const sourcePath = join(root, file);
      const destPath = join(repo.path, file);

      if (!existsSync(sourcePath)) continue;

      try {
        copyFileSync(sourcePath, destPath);
        synced.push(file);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${file}: ${message}`);
      }
    }
  }

  /**
   * Update engines field in the repo's root package.json.
   */
  private syncEngines(repo: MonorepoInfo, synced: string[], errors: string[]): void {
    try {
      const pkgPath = join(repo.path, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

      pkg.engines = { ...pkg.engines, ...ENGINES };
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      synced.push('package.json (engines)');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`package.json engines: ${message}`);
    }
  }

  /**
   * Sync PHP composer path repositories.
   *
   * Scans the monorepo for directories containing composer.json
   * and registers them as `path` repositories in the root composer.json.
   * This replaces ComposerScripts::reposSync().
   *
   * @param repo - The PHP monorepo
   * @param synced - Array to push synced items to
   * @param errors - Array to push errors to
   */
  private syncComposerRepos(repo: MonorepoInfo, synced: string[], errors: string[]): void {
    const composerPath = join(repo.path, 'composer.json');
    if (!existsSync(composerPath)) return;

    try {
      const composer = JSON.parse(readFileSync(composerPath, 'utf8'));

      // Discover all module directories with composer.json
      const moduleDirs = this.discoverComposerModules(repo.path);

      if (moduleDirs.length === 0) return;

      // Get existing path repositories
      const existingRepos: Array<{ type: string; url: string }> = composer.repositories || [];
      const existingPaths = new Set(
        existingRepos.filter((r) => r.type === 'path').map((r) => r.url)
      );

      // Add missing path repositories
      let added = 0;
      for (const moduleDir of moduleDirs) {
        const relativePath = './' + relative(repo.path, moduleDir);

        if (existingPaths.has(relativePath)) continue;

        existingRepos.push({
          type: 'path',
          url: relativePath,

          options: { symlink: true },
        } as any);

        added++;
      }

      if (added > 0) {
        composer.repositories = existingRepos;
        writeFileSync(composerPath, JSON.stringify(composer, null, 2) + '\n');
        synced.push(`composer.json (${added} path repos added)`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`composer repos: ${message}`);
    }
  }

  /**
   * Sync composer dependencies into package.json for turbo ordering.
   *
   * Reads each module's composer.json `require` field and mirrors
   * stackra/* dependencies into the module's package.json `dependencies`
   * so turbo can resolve the correct build order.
   *
   * This replaces sync-turbo-deps.js.
   *
   * @param repo - The PHP monorepo
   * @param synced - Array to push synced items to
   * @param errors - Array to push errors to
   */
  private syncTurboDeps(repo: MonorepoInfo, synced: string[], errors: string[]): void {
    try {
      // Build a map: composer name → npm name
      const composerToNpm = new Map<string, string>();
      const moduleDirs = this.discoverComposerModules(repo.path);

      // Also check applications/
      const appDirs = this.discoverComposerModules(repo.path, ['applications/*']);
      const allDirs = [...moduleDirs, ...appDirs];

      for (const dir of allDirs) {
        const composerFile = join(dir, 'composer.json');
        const pkgFile = join(dir, 'package.json');

        if (!existsSync(composerFile) || !existsSync(pkgFile)) continue;

        const composer = JSON.parse(readFileSync(composerFile, 'utf8'));
        const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));

        if (composer.name && pkg.name) {
          composerToNpm.set(composer.name, pkg.name);
        }
      }

      // Now sync deps
      let totalAdded = 0;

      for (const dir of allDirs) {
        const composerFile = join(dir, 'composer.json');
        const pkgFile = join(dir, 'package.json');

        if (!existsSync(composerFile) || !existsSync(pkgFile)) continue;

        const composer = JSON.parse(readFileSync(composerFile, 'utf8'));
        const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));

        // Get stackra/* composer deps
        const composerDeps = Object.keys(composer.require || {}).filter((k: string) =>
          k.startsWith('stackra/')
        );

        if (composerDeps.length === 0) continue;

        if (!pkg.dependencies) pkg.dependencies = {};
        let changed = false;

        for (const composerDep of composerDeps) {
          const npmName = composerToNpm.get(composerDep);
          if (npmName && !pkg.dependencies[npmName]) {
            pkg.dependencies[npmName] = 'workspace:*';
            changed = true;
            totalAdded++;
          }
        }

        if (changed) {
          // Sort dependencies
          const sorted: Record<string, string> = {};
          for (const k of Object.keys(pkg.dependencies).sort()) {
            sorted[k] = pkg.dependencies[k];
          }
          pkg.dependencies = sorted;
          writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
        }
      }

      if (totalAdded > 0) {
        synced.push(`turbo deps (${totalAdded} composer→package.json deps added)`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`turbo deps: ${message}`);
    }
  }

  /**
   * Discover all directories containing composer.json within a monorepo.
   *
   * Scans standard module paths (modules/category/package).
   *
   * @param repoPath - Absolute path to the monorepo root
   * @param globs - Optional custom glob patterns to scan
   * @returns Array of absolute paths to directories with composer.json
   */
  private discoverComposerModules(repoPath: string, globs?: string[]): string[] {
    const patterns = globs || ['modules/*/*', 'modules/*/*/*'];
    const found: string[] = [];

    for (const pattern of patterns) {
      const parts = pattern.split('/');
      let dirs = [repoPath];

      for (const part of parts) {
        const nextDirs: string[] = [];

        for (const dir of dirs) {
          if (!existsSync(dir)) continue;

          try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
              if (part === '*' || part === entry) {
                const fullPath = join(dir, entry);
                try {
                  if (statSync(fullPath).isDirectory()) {
                    nextDirs.push(fullPath);
                  }
                } catch {
                  /* skip */
                }
              }
            }
          } catch {
            /* skip */
          }
        }

        dirs = nextDirs;
      }

      for (const dir of dirs) {
        if (existsSync(join(dir, 'composer.json'))) {
          found.push(dir);
        }
      }
    }

    return [...new Set(found)];
  }
}
