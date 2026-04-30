/**
 * UpgradeCommand — upgrade dependencies across monorepos.
 *
 * Runs `pnpm update --latest` or `ncu -u` across all (or selected)
 * monorepos to bring dependencies up to date.
 *
 * @module commands/upgrade
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono upgrade                   # upgrade all repos
 * mono upgrade --interactive     # interactive mode with ncu
 * mono upgrade -r frontend       # upgrade frontend only
 * ```
 */

import * as p from '@clack/prompts';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import type { GlobalOptions, CommandResult } from '@/types';
import { discoverMonorepos, findWorkspaceRoot, runCommand } from '@/utils';
import { theme, symbols, formatDuration, printResultsTable } from '@/utils/ui';

/**
 * Upgrade command — updates dependencies across repos.
 */
@Command({
  name: 'upgrade',
  description: 'Upgrade dependencies across repos',
  emoji: '⬆️',
  category: 'tools',
  args: '[--interactive]',
  aliases: ['up'],
})
@Injectable()
export class UpgradeCommand extends BaseCommand {
  /**
   * Execute the upgrade command.
   *
   * @param args - Optional --interactive flag
   * @param opts - Global CLI options
   */
  async handle(args: string[], opts: GlobalOptions): Promise<void> {
    const root = findWorkspaceRoot();
    const repos = discoverMonorepos(root);

    const filtered = opts.repo
      ? repos.filter((r) => opts.repo!.some((name) => r.name.includes(name)))
      : repos;

    if (filtered.length === 0) {
      this.warn('No matching repos found.', opts);
      return;
    }

    const useNcu = args.includes('--interactive');
    const command = useNcu ? 'npx npm-check-updates -u' : 'pnpm update --latest';

    if (!opts.json) {
      p.intro(theme.primary('  ⬆️  Upgrade  '));
      this.info(
        `${theme.muted('Strategy:')} ${useNcu ? 'ncu -u (interactive)' : 'pnpm update --latest'}`,
        opts
      );
      this.info(`${theme.muted('Repos:')} ${filtered.map((r) => r.name).join(', ')}`, opts);
    }

    // Confirm before upgrading
    if (opts.interactive && !opts.json) {
      const confirmed = await p.confirm({
        message: `Upgrade dependencies in ${filtered.length} repo(s)?`,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Cancelled.');
        return;
      }
    }

    const results: CommandResult[] = [];
    const s = this.spinner(opts);

    for (let i = 0; i < filtered.length; i++) {
      const repo = filtered[i]!;

      if (!repo.ecosystems.includes('node')) {
        if (!opts.json) {
          this.info(`${theme.dim(repo.name)} — skipping (not a Node repo)`, opts);
        }
        continue;
      }

      s?.start(`Upgrading ${theme.bold(repo.name)} (${i + 1}/${filtered.length})...`);

      const result = await runCommand(command, repo.path);
      results.push({ ...result, repo: repo.name });

      if (!opts.json) {
        const icon = result.success ? symbols.success : symbols.error;
        s?.stop(`${icon} ${theme.bold(repo.name)} ${theme.dim(formatDuration(result.duration))}`);

        if (!result.success && opts.verbose) {
          console.log(theme.error(result.stderr.slice(-500)));
        }
      }
    }

    // Run install after upgrading
    if (results.some((r) => r.success) && !useNcu) {
      s?.start('Installing updated dependencies...');

      for (const repo of filtered) {
        if (!repo.ecosystems.includes('node')) continue;
        await runCommand('pnpm install', repo.path);
      }

      s?.stop(`${symbols.success} Dependencies installed`);
    }

    this.output(results, opts, (data) => {
      console.log('');
      printResultsTable(data);

      const totalTime = data.reduce((sum, r) => sum + r.duration, 0);
      const passed = data.filter((r) => r.success).length;
      const failed = data.filter((r) => !r.success).length;

      p.outro(
        failed === 0
          ? theme.success(
              `${passed} repo${passed > 1 ? 's' : ''} upgraded ${theme.dim(`(${formatDuration(totalTime)})`)}`
            )
          : theme.error(
              `${failed} failed, ${passed} upgraded ${theme.dim(`(${formatDuration(totalTime)})`)}`
            )
      );

      if (failed > 0) process.exit(1);
    });
  }
}
