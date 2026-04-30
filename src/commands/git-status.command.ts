/**
 * GitStatusCommand — show git status across all monorepos.
 *
 * Runs `git status --short` in each repo and displays a
 * summary of uncommitted changes, untracked files, and
 * branch information.
 *
 * @module commands/git-status
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono git-status                # status across all repos
 * mono git-status -r frontend    # status for frontend only
 * mono git-status --json         # JSON output for CI
 * ```
 */

import * as p from '@clack/prompts';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import type { GlobalOptions } from '@/types';
import { discoverMonorepos, findWorkspaceRoot, runAcrossReposParallel } from '@/utils';
import { theme, symbols } from '@/utils/ui';

/**
 * Git status command — shows uncommitted changes across repos.
 */
@Command({
  name: 'git-status',
  description: 'Show git status across all repos',
  emoji: '📊',
  category: 'git',
  aliases: ['gs'],
})
@Injectable()
export class GitStatusCommand extends BaseCommand {
  /**
   * Execute the git status command.
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
      p.intro(theme.primary('  📊 Git Status  '));
    }

    const s = this.spinner(opts);
    s?.start('Checking git status across repos...');

    const [statusResults, branchResults] = await Promise.all([
      runAcrossReposParallel('git status --short', filtered),
      runAcrossReposParallel('git rev-parse --abbrev-ref HEAD', filtered),
    ]);

    s?.stop('Git status checked');

    const data = filtered.map((repo, i) => {
      const status = statusResults[i]!;
      const branch = branchResults[i]!;
      const changes = status.stdout.split('\n').filter(Boolean);

      return {
        name: repo.name,
        branch: branch.stdout.trim(),
        changes: changes.length,
        files: changes.map((line) => ({
          status: line.substring(0, 2).trim(),
          file: line.substring(3).trim(),
        })),
      };
    });

    this.output(data, opts, (results) => {
      console.log('');

      for (const repo of results) {
        const statusIcon =
          repo.changes === 0
            ? `${symbols.success} clean`
            : `${symbols.warning} ${repo.changes} change${repo.changes > 1 ? 's' : ''}`;

        console.log(
          `  ${theme.bold(repo.name.padEnd(25))} ${theme.info(repo.branch.padEnd(20))} ${statusIcon}`
        );

        if (opts.verbose && repo.files.length > 0) {
          for (const file of repo.files) {
            console.log(`    ${theme.warning(file.status.padEnd(4))} ${theme.dim(file.file)}`);
          }
        }
      }

      const totalChanges = results.reduce((sum, r) => sum + r.changes, 0);
      const cleanRepos = results.filter((r) => r.changes === 0).length;

      console.log('');
      p.outro(
        totalChanges === 0
          ? theme.success('All repos are clean')
          : theme.muted(
              `${cleanRepos}/${results.length} clean, ${totalChanges} total uncommitted changes`
            )
      );
    });
  }
}
