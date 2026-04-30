/**
 * PublishCommand — publish packages to npm with provenance.
 *
 * Detects which packages have changed via git diff, builds
 * each one, and publishes to npm with --provenance support.
 *
 * @module commands/publish
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono publish                   # publish changed packages
 * mono publish --dry-run         # preview what would be published
 * mono publish -r frontend       # publish from frontend only
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
 * Publish command — publishes changed packages to npm.
 */
@Command({
  name: 'publish',
  description: 'Publish changed packages to npm',
  emoji: '📦',
  category: 'tools',
  args: '[--dry-run]',
  aliases: ['pub'],
})
@Injectable()
export class PublishCommand extends BaseCommand {
  /**
   * Execute the publish command.
   *
   * @param args - Optional --dry-run flag
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

    const isDryRun = args.includes('--dry-run');

    if (!opts.json) {
      p.intro(theme.primary(`  📦 Publish${isDryRun ? ' (dry run)' : ''}  `));
      this.info(`${theme.muted('Repos:')} ${filtered.map((r) => r.name).join(', ')}`, opts);
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

      // 1. Detect changed packages via git diff
      s?.start(`Detecting changes in ${theme.bold(repo.name)}...`);

      const diffResult = await runCommand('git diff --name-only HEAD~1 -- packages/', repo.path);

      const changedPaths = diffResult.stdout
        .split('\n')
        .filter(Boolean)
        .map((f) => f.split('/')[1])
        .filter((v, i, a) => v && a.indexOf(v) === i);

      if (changedPaths.length === 0) {
        if (!opts.json) {
          s?.stop(`${symbols.info} ${theme.bold(repo.name)} ${theme.dim('no changes')}`);
        }
        results.push({
          repo: repo.name,
          success: true,
          stdout: 'No changed packages',
          stderr: '',
          exitCode: 0,
          duration: 0,
        });
        continue;
      }

      s?.stop(
        `${symbols.info} ${theme.bold(repo.name)} — ${changedPaths.length} changed package(s)`
      );

      // 2. Build changed packages
      s?.start(`Building ${theme.bold(repo.name)}...`);

      const buildResult = await runCommand('pnpm turbo run build', repo.path);

      if (!buildResult.success) {
        s?.stop(`${symbols.error} ${theme.bold(repo.name)} ${theme.error('build failed')}`);
        results.push({ ...buildResult, repo: repo.name });
        continue;
      }

      s?.stop(`${symbols.success} ${theme.bold(repo.name)} built`);

      // 3. Publish each changed package
      for (const pkg of changedPaths) {
        s?.start(`Publishing ${theme.bold(pkg)}...`);

        const publishCmd = isDryRun
          ? `pnpm publish --dry-run --no-git-checks`
          : `pnpm publish --access public --provenance --no-git-checks`;

        const publishResult = await runCommand(publishCmd, `${repo.path}/packages/${pkg}`);
        results.push({ ...publishResult, repo: `${repo.name}/${pkg}` });

        if (!opts.json) {
          const icon = publishResult.success ? symbols.success : symbols.error;
          s?.stop(
            `${icon} ${theme.bold(pkg)} ${theme.dim(formatDuration(publishResult.duration))}`
          );
        }
      }
    }

    this.output(results, opts, (data) => {
      console.log('');
      printResultsTable(data);

      const published = data.filter((r) => r.success && r.stdout !== 'No changed packages').length;
      const skipped = data.filter((r) => r.stdout === 'No changed packages').length;
      const failed = data.filter((r) => !r.success).length;

      const parts: string[] = [];
      if (published > 0) parts.push(`${published} published`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      if (failed > 0) parts.push(`${failed} failed`);

      p.outro(
        failed === 0
          ? theme.success(parts.join(', ') + (isDryRun ? ' (dry run)' : ''))
          : theme.error(parts.join(', '))
      );

      if (failed > 0) process.exit(1);
    });
  }
}
