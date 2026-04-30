/**
 * StatusCommand — show workspace overview and git status.
 *
 * The default command when running `mono` with no arguments.
 * Discovers all monorepos, shows their ecosystems, and checks
 * git status across all repos.
 *
 * @module commands/status
 * @since 1.0.0
 */

import * as p from '@clack/prompts';
import { Injectable } from '@stackra/ts-container';

import { discoverMonorepos, findWorkspaceRoot, runAcrossReposParallel } from '@/utils';
import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import type { GlobalOptions } from '@/types';
import { theme, symbols, printReposTable } from '@/utils/ui';

/**
 * Shows workspace overview — detected monorepos, ecosystems,
 * and git status across all repos.
 */
@Command({
  name: 'status',
  description: 'Show workspace overview and git status',
  emoji: '📊',
  category: 'core',
  isDefault: true,
})
@Injectable()
export class StatusCommand extends BaseCommand {
  /**
   * Execute the status command.
   *
   * @param args - Unused positional arguments
   * @param opts - Global CLI options
   */
  async handle(_args: string[], opts: GlobalOptions): Promise<void> {
    const root = findWorkspaceRoot();
    const repos = discoverMonorepos(root);

    if (repos.length === 0) {
      this.warn('No monorepos found in the workspace.', opts);
      return;
    }

    /** Filter by --repo if specified. */
    const filtered = opts.repo
      ? repos.filter((r) => opts.repo!.some((name) => r.name.includes(name)))
      : repos;

    // JSON mode — include git status counts
    if (opts.json) {
      const gitResults = await runAcrossReposParallel('git status --short', filtered);
      const data = filtered.map((repo, i) => ({
        ...repo,
        gitChanges: gitResults[i]!.stdout.split('\n').filter(Boolean).length,
      }));
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    // Interactive mode
    p.intro(theme.primary('  Stackra Workspace  '));

    this.info(`${theme.muted('Root:')} ${root}`, opts);
    this.info(`${theme.muted('Repos:')} ${filtered.length} monorepos discovered`, opts);

    console.log('');
    printReposTable(filtered);

    // Git status summary
    const s = this.spinner(opts);
    s?.start('Checking git status...');

    const gitResults = await runAcrossReposParallel('git status --short', filtered);

    s?.stop('Git status checked');

    console.log('');
    for (let i = 0; i < filtered.length; i++) {
      const repo = filtered[i]!;
      const changes = gitResults[i]!.stdout.split('\n').filter(Boolean).length;
      const status =
        changes === 0
          ? `${symbols.success} clean`
          : `${symbols.warning} ${changes} uncommitted change${changes > 1 ? 's' : ''}`;

      console.log(`  ${theme.bold(repo.name.padEnd(25))} ${status}`);
    }

    p.outro(theme.muted('Run `mono --help` for available commands'));
  }
}
