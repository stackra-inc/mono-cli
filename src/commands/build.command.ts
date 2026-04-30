/**
 * BuildCommand — run turbo build across monorepos.
 *
 * Proxies to `pnpm turbo run build` in each monorepo,
 * leveraging turbo's caching and parallelism.
 *
 * @module commands/build
 * @since 1.0.0
 */

import * as p from '@clack/prompts';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import type { GlobalOptions, CommandResult } from '@/types';
import { discoverMonorepos, findWorkspaceRoot, runCommand } from '@/utils';
import { theme, symbols, formatDuration, printResultsTable } from '@/utils/ui';

/**
 * Build command — runs turbo build across all monorepos.
 */
@Command({
  name: 'build',
  description: 'Build all repos via turbo',
  emoji: '🔨',
  category: 'tasks',
  aliases: ['b'],
})
@Injectable()
export class BuildCommand extends BaseCommand {
  /**
   * Execute the build command.
   *
   * @param args - Additional turbo arguments
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

    const turboArgs = args.length > 0 ? ` ${args.join(' ')}` : '';
    const command = `pnpm turbo run build${turboArgs}`;

    if (!opts.json) {
      p.intro(theme.primary('  🔨 Build  '));
      this.info(`${theme.muted('Command:')} ${command}`, opts);
      this.info(`${theme.muted('Repos:')} ${filtered.map((r) => r.name).join(', ')}`, opts);
    }

    const results: CommandResult[] = [];
    const s = this.spinner(opts);

    for (let i = 0; i < filtered.length; i++) {
      const repo = filtered[i]!;
      s?.start(`Building ${theme.bold(repo.name)} (${i + 1}/${filtered.length})...`);

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
              `${passed} repo${passed > 1 ? 's' : ''} built ${theme.dim(`(${formatDuration(totalTime)})`)}`
            )
          : theme.error(
              `${failed} failed, ${passed} passed ${theme.dim(`(${formatDuration(totalTime)})`)}`
            )
      );

      if (failed > 0) process.exit(1);
    });
  }
}
