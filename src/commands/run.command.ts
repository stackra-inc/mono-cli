/**
 * RunCommand — generic turbo run proxy.
 *
 * Proxies any task to `pnpm turbo run <task>` across all
 * (or selected) monorepos. When no task is specified, shows
 * an interactive picker of available scripts discovered from
 * each repo's package.json.
 *
 * @module commands/run
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono run                       # interactive script picker
 * mono run lint                  # lint all repos
 * mono run test --filter=web     # test with turbo filter
 * mono run dev -r frontend       # dev in frontend only
 * mono run --json lint           # JSON output
 * ```
 */

import * as p from '@clack/prompts';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import type { GlobalOptions, CommandResult } from '@/types';
import { discoverMonorepos, findWorkspaceRoot, runCommand } from '@/utils';
import { theme, symbols, formatDuration, printResultsTable } from '@/utils/ui';
import { TASK_EMOJI } from '@/config/platforms';
import { collectScriptMap } from '@/utils/scripts';

/**
 * Generic turbo run proxy command.
 *
 * Runs `pnpm turbo run <task>` in each discovered monorepo,
 * passing through any additional arguments to turbo.
 * Shows an interactive script picker when no task is specified.
 */
@Command({
  name: 'run',
  description: 'Run a turbo task across all repos',
  emoji: '▶️',
  category: 'tasks',
  args: '[task] [args...]',
  aliases: ['r'],
})
@Injectable()
export class RunCommand extends BaseCommand {
  /**
   * Execute the run command.
   *
   * @param args - [task?, ...turboArgs]
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

    let task = args[0];

    // If no task specified, show interactive picker or list
    if (!task) {
      const scriptMap = collectScriptMap(filtered);

      if (opts.json) {
        // JSON mode — output all available scripts
        const scripts = [...scriptMap.entries()].map(([name, repoNames]) => ({
          name,
          repos: repoNames,
          count: repoNames.length,
        }));
        console.log(JSON.stringify(scripts, null, 2));
        return;
      }

      if (!opts.interactive) {
        // Non-interactive — show available scripts and exit
        p.intro(theme.primary('  ▶️  Available Scripts  '));
        console.log('');

        const sorted = [...scriptMap.entries()].sort((a, b) => b[1].length - a[1].length);

        for (const [name, repoNames] of sorted) {
          const emoji = TASK_EMOJI[name] || '▶️';
          const repoCount =
            repoNames.length === filtered.length
              ? theme.success('all')
              : theme.dim(`${repoNames.length}/${filtered.length}`);
          console.log(`  ${emoji} ${theme.bold(name.padEnd(20))} ${repoCount}`);
        }

        console.log('');
        p.outro(theme.muted('Usage: mono run <task> [turbo-args...]'));
        return;
      }

      // Interactive mode — let user pick a script
      const sorted = [...scriptMap.entries()].sort((a, b) => b[1].length - a[1].length);

      const selected = await p.select({
        message: 'Select a task to run:',
        options: sorted.map(([name, repoNames]) => {
          const emoji = TASK_EMOJI[name] || '▶️';
          const hint =
            repoNames.length === filtered.length
              ? 'all repos'
              : `${repoNames.length} repo${repoNames.length > 1 ? 's' : ''}`;
          return {
            value: name,
            label: `${emoji} ${name}`,
            hint,
          };
        }),
      });

      if (p.isCancel(selected)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }

      task = selected;
    }

    // Execute the task
    const extraArgs = args.slice(1).join(' ');
    const command = `pnpm turbo run ${task}${extraArgs ? ` ${extraArgs}` : ''}`;
    const emoji = TASK_EMOJI[task] || '▶️';

    if (!opts.json) {
      p.intro(theme.primary(`  ${emoji} Run: ${task}  `));
      this.info(`${theme.muted('Command:')} ${command}`, opts);
      this.info(`${theme.muted('Repos:')} ${filtered.map((r) => r.name).join(', ')}`, opts);
    }

    const results: CommandResult[] = [];
    const s = this.spinner(opts);

    for (let i = 0; i < filtered.length; i++) {
      const repo = filtered[i]!;
      s?.start(
        `Running ${theme.bold(task)} in ${theme.bold(repo.name)} (${i + 1}/${filtered.length})...`
      );

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
              `${passed} repo${passed > 1 ? 's' : ''} completed ${theme.dim(`(${formatDuration(totalTime)})`)}`
            )
          : theme.error(
              `${failed} failed, ${passed} passed ${theme.dim(`(${formatDuration(totalTime)})`)}`
            )
      );

      if (failed > 0) process.exit(1);
    });
  }
}
