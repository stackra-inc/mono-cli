/**
 * CleanCommand — remove build artifacts, caches, and dependencies.
 *
 * Runs the universal cleanup script across all (or selected) monorepos.
 * Supports interactive mode selection and --json output.
 *
 * @module commands/clean
 * @since 1.0.0
 */

import * as p from '@clack/prompts';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import { discoverMonorepos, findWorkspaceRoot, runCommand } from '@/utils';
import { theme, symbols, formatDuration, printResultsTable } from '@/utils/ui';
import type { CleanMode, GlobalOptions, CommandResult } from '@/types';

/** Valid cleanup modes with descriptions. */
const CLEAN_MODES: Record<CleanMode, string> = {
  build: 'Build artifacts (dist, coverage, .next, vendor/public/build)',
  cache: 'Caches (turbo, eslint, tsbuildinfo, bootstrap/cache)',
  deps: 'Dependencies (node_modules, vendor, lockfiles)',
  tmp: 'Temp files (.DS_Store, Thumbs.db, .tmp)',
  all: 'Everything (build + cache + tmp + deps)',
};

/**
 * Universal cleanup command.
 * Auto-detects ecosystem and cleans the right artifacts.
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
    const results: CommandResult[] = [];
    const s = this.spinner(opts);

    for (let i = 0; i < filtered.length; i++) {
      const repo = filtered[i]!;
      s?.start(`Cleaning ${theme.bold(repo.name)} (${i + 1}/${filtered.length})...`);

      const result = await runCommand(`./scripts/cleanup.sh ${cleanMode}`, repo.path);
      results.push({ ...result, repo: repo.name });

      if (!opts.json) {
        const icon = result.success ? symbols.success : symbols.error;
        s?.stop(`${icon} ${theme.bold(repo.name)} ${theme.dim(formatDuration(result.duration))}`);
      }
    }

    // Output results
    this.output(results, opts, (data) => {
      console.log('');
      printResultsTable(data);

      const totalTime = data.reduce((sum, r) => sum + r.duration, 0);
      const allPassed = data.every((r) => r.success);

      p.outro(
        allPassed
          ? theme.success(`All clean ${theme.dim(`(${formatDuration(totalTime)})`)}`)
          : theme.error('Some repos failed — check output above')
      );
    });
  }
}
