/**
 * SyncCommand — sync configs and scripts across monorepos.
 *
 * Copies shared configuration files (cleanup.sh, .editorconfig,
 * .prettierignore) and updates engine constraints in all
 * package.json files across the workspace.
 *
 * @module commands/sync
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono sync                      # sync all configs
 * mono sync -r frontend          # sync frontend only
 * mono sync --json               # JSON output for CI
 * ```
 */

import * as p from '@clack/prompts';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import type { GlobalOptions } from '@/types';
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
 * Sync command — copies shared configs across repos.
 */
@Command({
  name: 'sync',
  description: 'Sync configs and scripts across repos',
  emoji: '🔄',
  category: 'tools',
  aliases: ['s'],
})
@Injectable()
export class SyncCommand extends BaseCommand {
  /**
   * Execute the sync command.
   *
   * @param args - Unused positional arguments
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

    const results: Array<{ repo: string; synced: string[]; errors: string[] }> = [];

    for (const repo of filtered) {
      const synced: string[] = [];
      const errors: string[] = [];

      // 1. Sync shared config files from workspace root
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

      // 2. Sync cleanup.sh if it exists
      const cleanupSource = join(root, 'scripts', 'cleanup.sh');
      const cleanupDest = join(repo.path, 'scripts', 'cleanup.sh');

      if (existsSync(cleanupSource)) {
        try {
          copyFileSync(cleanupSource, cleanupDest);
          synced.push('scripts/cleanup.sh');
        } catch {
          // scripts/ dir might not exist — that's ok
        }
      }

      // 3. Update engines in package.json
      if (repo.ecosystems.includes('node')) {
        try {
          const pkgPath = join(repo.path, 'package.json');
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

          pkg.engines = { ...pkg.engines, ...ENGINES };
          writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
          synced.push('package.json (engines)');
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`package.json: ${message}`);
        }
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
          ? theme.success(`${totalSynced} files synced across ${data.length} repos`)
          : theme.warning(
              `${totalSynced} synced, ${totalErrors} errors across ${data.length} repos`
            )
      );
    });
  }
}
