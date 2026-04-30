/**
 * FormatCommand — format code with prettier across repos.
 *
 * Runs prettier in each monorepo to format or check code style.
 * Supports --check mode for CI validation.
 *
 * @module commands/format
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono format                    # format all repos
 * mono format --check            # check formatting (CI mode)
 * mono format -r frontend        # format frontend only
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
 * Format command — runs prettier across all repos.
 */
@Command({
  name: 'format',
  description: 'Format code with prettier across repos',
  emoji: '✨',
  category: 'tasks',
  args: '[--check]',
  aliases: ['fmt'],
})
@Injectable()
export class FormatCommand extends BaseCommand {
  /**
   * Execute the format command.
   *
   * @param args - Optional --check flag
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

    const isCheck = args.includes('--check');
    const command = isCheck ? 'pnpm prettier --check .' : 'pnpm prettier --write .';

    if (!opts.json) {
      p.intro(theme.primary(`  ✨ Format${isCheck ? ' (check)' : ''}  `));
      this.info(`${theme.muted('Command:')} ${command}`, opts);
      this.info(`${theme.muted('Repos:')} ${filtered.map((r) => r.name).join(', ')}`, opts);
    }

    const results: CommandResult[] = [];
    const s = this.spinner(opts);

    for (let i = 0; i < filtered.length; i++) {
      const repo = filtered[i]!;
      s?.start(`Formatting ${theme.bold(repo.name)} (${i + 1}/${filtered.length})...`);

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

    this.output(results, opts, (data) => {
      console.log('');
      printResultsTable(data);

      const totalTime = data.reduce((sum, r) => sum + r.duration, 0);
      const passed = data.filter((r) => r.success).length;
      const failed = data.filter((r) => !r.success).length;

      p.outro(
        failed === 0
          ? theme.success(
              `${passed} repo${passed > 1 ? 's' : ''} ${isCheck ? 'formatted correctly' : 'formatted'} ${theme.dim(`(${formatDuration(totalTime)})`)}`
            )
          : theme.error(
              `${failed} failed, ${passed} passed ${theme.dim(`(${formatDuration(totalTime)})`)}`
            )
      );

      if (failed > 0) process.exit(1);
    });
  }
}
