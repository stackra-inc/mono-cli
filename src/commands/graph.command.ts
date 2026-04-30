/**
 * GraphCommand — generate dependency graphs for monorepos.
 *
 * Uses `pnpm turbo run build --graph` to generate dependency
 * graphs in various formats (dot, json, html).
 *
 * @module commands/graph
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono graph                     # generate graph (default: stdout)
 * mono graph --format=dot        # DOT format for Graphviz
 * mono graph --format=json       # JSON format
 * mono graph -r frontend         # graph for frontend only
 * ```
 */

import * as p from '@clack/prompts';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import type { GlobalOptions, CommandResult } from '@/types';
import { discoverMonorepos, findWorkspaceRoot, runCommand } from '@/utils';
import { theme, symbols, formatDuration } from '@/utils/ui';

/** Supported graph output formats. */
type GraphFormat = 'dot' | 'json' | 'html';

/**
 * Graph generation command.
 *
 * Generates dependency graphs using turbo's built-in graph
 * generation, with support for multiple output formats.
 */
@Command({
  name: 'graph',
  description: 'Generate dependency graphs',
  emoji: '🕸️',
  category: 'tools',
  args: '[--format]',
  aliases: ['g'],
})
@Injectable()
export class GraphCommand extends BaseCommand {
  /**
   * Execute the graph command.
   *
   * @param args - Optional format flag
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

    // Parse --format flag from args
    let format: GraphFormat = 'dot';
    const formatArg = args.find((a) => a.startsWith('--format'));

    if (formatArg) {
      const value = formatArg.includes('=')
        ? formatArg.split('=')[1]
        : args[args.indexOf(formatArg) + 1];
      if (value && ['dot', 'json', 'html'].includes(value)) {
        format = value as GraphFormat;
      }
    }

    if (!opts.json) {
      p.intro(theme.primary('  🕸️  Graph  '));
      this.info(`${theme.muted('Format:')} ${format}`, opts);
      this.info(`${theme.muted('Repos:')} ${filtered.map((r) => r.name).join(', ')}`, opts);
    }

    const results: CommandResult[] = [];
    const s = this.spinner(opts);

    for (let i = 0; i < filtered.length; i++) {
      const repo = filtered[i]!;

      if (!repo.hasTurbo) {
        if (!opts.json) {
          this.warn(`${repo.name} has no turbo.json — skipping`, opts);
        }
        continue;
      }

      s?.start(`Generating graph for ${theme.bold(repo.name)} (${i + 1}/${filtered.length})...`);

      const graphFile = format === 'html' ? 'graph.html' : `graph.${format}`;
      const command = `pnpm turbo run build --graph=${graphFile}`;
      const result = await runCommand(command, repo.path);
      results.push({ ...result, repo: repo.name });

      if (!opts.json) {
        const icon = result.success ? symbols.success : symbols.error;
        s?.stop(
          `${icon} ${theme.bold(repo.name)} ${symbols.arrow} ${theme.info(graphFile)} ${theme.dim(formatDuration(result.duration))}`
        );
      }
    }

    this.output(results, opts, (data) => {
      const passed = data.filter((r) => r.success).length;
      const failed = data.filter((r) => !r.success).length;

      console.log('');
      p.outro(
        failed === 0
          ? theme.success(`${passed} graph${passed > 1 ? 's' : ''} generated`)
          : theme.error(`${failed} failed, ${passed} generated`)
      );
    });
  }
}
