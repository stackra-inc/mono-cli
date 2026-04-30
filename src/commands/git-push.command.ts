/**
 * GitPushCommand — commit and push changes across all monorepos.
 *
 * Stages all changes, commits with the provided message, and
 * pushes to the current branch in each repo that has uncommitted
 * changes.
 *
 * @module commands/git-push
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono git-push "feat: add new feature"    # commit + push all
 * mono git-push -r frontend "fix: typo"    # push frontend only
 * mono git-push --json "chore: cleanup"    # JSON output for CI
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
 * Git push command — commit and push across repos.
 */
@Command({
  name: 'git-push',
  description: 'Commit and push changes across all repos',
  emoji: '📤',
  category: 'git',
  args: '[message]',
  aliases: ['gp'],
})
@Injectable()
export class GitPushCommand extends BaseCommand {
  /**
   * Execute the git push command.
   *
   * @param args - [commitMessage]
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

    // Get commit message
    let message = args[0];

    if (!message && opts.interactive) {
      const input = await p.text({
        message: 'Commit message:',
        placeholder: 'chore: update',
        validate: (val) => (!val || val.length === 0 ? 'Commit message is required' : undefined),
      });

      if (p.isCancel(input)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }

      message = input;
    }

    if (!message) {
      this.error('Commit message is required. Usage: mono git-push "your message"', opts);
      return;
    }

    if (!opts.json) {
      p.intro(theme.primary('  📤 Git Push  '));
      this.info(`${theme.muted('Message:')} ${message}`, opts);
      this.info(`${theme.muted('Repos:')} ${filtered.map((r) => r.name).join(', ')}`, opts);
    }

    const results: CommandResult[] = [];
    const s = this.spinner(opts);

    for (let i = 0; i < filtered.length; i++) {
      const repo = filtered[i]!;
      s?.start(`Pushing ${theme.bold(repo.name)} (${i + 1}/${filtered.length})...`);

      // Check if there are changes to commit
      const statusResult = await runCommand('git status --short', repo.path);
      const hasChanges = statusResult.stdout.trim().length > 0;

      if (!hasChanges) {
        results.push({
          repo: repo.name,
          success: true,
          stdout: 'No changes to commit',
          stderr: '',
          exitCode: 0,
          duration: 0,
        });

        if (!opts.json) {
          s?.stop(`${symbols.info} ${theme.bold(repo.name)} ${theme.dim('no changes')}`);
        }
        continue;
      }

      // Stage, commit, and push
      const start = Date.now();
      const addResult = await runCommand('git add -A', repo.path);

      if (!addResult.success) {
        results.push({ ...addResult, repo: repo.name });
        if (!opts.json) {
          s?.stop(`${symbols.error} ${theme.bold(repo.name)} ${theme.error('failed to stage')}`);
        }
        continue;
      }

      const escapedMessage = message.replace(/"/g, '\\"');
      const commitResult = await runCommand(`git commit -m "${escapedMessage}"`, repo.path);

      if (!commitResult.success) {
        results.push({ ...commitResult, repo: repo.name });
        if (!opts.json) {
          s?.stop(`${symbols.error} ${theme.bold(repo.name)} ${theme.error('failed to commit')}`);
        }
        continue;
      }

      const pushResult = await runCommand('git push', repo.path);
      const duration = Date.now() - start;

      results.push({ ...pushResult, repo: repo.name, duration });

      if (!opts.json) {
        const icon = pushResult.success ? symbols.success : symbols.error;
        s?.stop(`${icon} ${theme.bold(repo.name)} ${theme.dim(formatDuration(duration))}`);
      }
    }

    this.output(results, opts, (data) => {
      console.log('');
      printResultsTable(data);

      const pushed = data.filter((r) => r.success && r.stdout !== 'No changes to commit').length;
      const skipped = data.filter((r) => r.stdout === 'No changes to commit').length;
      const failed = data.filter((r) => !r.success).length;

      const parts: string[] = [];
      if (pushed > 0) parts.push(`${pushed} pushed`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      if (failed > 0) parts.push(`${failed} failed`);

      p.outro(failed === 0 ? theme.success(parts.join(', ')) : theme.error(parts.join(', ')));

      if (failed > 0) process.exit(1);
    });
  }
}
