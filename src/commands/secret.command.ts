/**
 * SecretCommand — manage secrets stored in ~/.stackra/secrets.json.
 *
 * Provides CRUD operations for secrets with support for multiple
 * values per key, default selection, and importing tokens from
 * gh/glab CLI tools.
 *
 * @module commands/secret
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono secret set NPM_TOKEN              # prompt for value
 * mono secret set NPM_TOKEN abc123       # set directly
 * mono secret get NPM_TOKEN              # retrieve default
 * mono secret list                       # list all secrets
 * mono secret delete NPM_TOKEN           # remove all entries
 * mono secret use NPM_TOKEN --default    # set default entry
 * mono secret set GH_TOKEN --from-gh     # import from gh cli
 * ```
 */

import * as p from '@clack/prompts';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import { SecretStore } from '@/services/secret-store';
import type { GlobalOptions } from '@/types';
import { theme, symbols, header } from '@/utils/ui';
import { runCommand } from '@/utils';

/** Supported secret subcommands. */
type SecretAction = 'set' | 'get' | 'list' | 'delete' | 'use';

/**
 * Secret management command.
 *
 * Delegates to the SecretStore service for all CRUD operations.
 * Supports interactive prompts for missing values and importing
 * tokens from external CLI tools.
 */
@Command({
  name: 'secret',
  description: 'Manage stored secrets',
  emoji: '🔐',
  category: 'secrets',
  args: '<action> [key] [value]',
})
@Injectable()
export class SecretCommand extends BaseCommand {
  constructor(private readonly store: SecretStore) {
    super();
  }

  /**
   * Execute the secret command.
   *
   * @param args - [action, key?, value?]
   * @param opts - Global CLI options
   */
  async handle(args: string[], opts: GlobalOptions): Promise<void> {
    const action = args[0] as SecretAction | undefined;

    if (!action || !['set', 'get', 'list', 'delete', 'use'].includes(action)) {
      this.error('Usage: mono secret <set|get|list|delete|use> [key] [value]', opts);
      return;
    }

    switch (action) {
      case 'set':
        await this.handleSet(args.slice(1), opts);
        break;
      case 'get':
        await this.handleGet(args.slice(1), opts);
        break;
      case 'list':
        await this.handleList(opts);
        break;
      case 'delete':
        await this.handleDelete(args.slice(1), opts);
        break;
      case 'use':
        await this.handleUse(args.slice(1), opts);
        break;
    }
  }

  // ── Subcommand Handlers ──────────────────────────────────────

  /**
   * Handle `mono secret set <key> [value]`.
   *
   * @param args - [key, value?, --from-gh?, --from-glab?]
   * @param opts - Global CLI options
   */
  private async handleSet(args: string[], opts: GlobalOptions): Promise<void> {
    const key = args[0];

    if (!key) {
      this.error('Usage: mono secret set <key> [value]', opts);
      return;
    }

    // Check for --from-gh or --from-glab flags
    const fromGh = args.includes('--from-gh');
    const fromGlab = args.includes('--from-glab');

    let value: string | undefined;
    let source: 'manual' | 'gh-cli' | 'glab-cli' = 'manual';

    if (fromGh) {
      const result = await runCommand('gh auth token', process.cwd());
      if (!result.success) {
        this.error('Failed to get token from gh CLI. Is it installed and authenticated?', opts);
        return;
      }
      value = result.stdout.trim();
      source = 'gh-cli';
    } else if (fromGlab) {
      const result = await runCommand('glab auth status -t', process.cwd());
      if (!result.success) {
        this.error('Failed to get token from glab CLI. Is it installed and authenticated?', opts);
        return;
      }
      // Parse token from glab output
      const tokenMatch = result.stdout.match(/Token:\s*(\S+)/);
      value = tokenMatch?.[1] || result.stdout.trim();
      source = 'glab-cli';
    } else {
      // Get value from args or prompt
      value = args.find((a) => !a.startsWith('--') && a !== key);

      if (!value && opts.interactive) {
        const input = await p.password({
          message: `Value for ${theme.bold(key)}:`,
          validate: (val) => (!val || val.length === 0 ? 'Value is required' : undefined),
        });

        if (p.isCancel(input)) {
          p.cancel('Cancelled.');
          process.exit(0);
        }

        value = input;
      }
    }

    if (!value) {
      this.error('Value is required. Provide it as an argument or run interactively.', opts);
      return;
    }

    // Prompt for label if interactive
    let label: string | undefined;

    if (opts.interactive) {
      const input = await p.text({
        message: 'Label (optional):',
        placeholder: `${key} — default`,
        defaultValue: key,
      });

      if (!p.isCancel(input)) {
        label = input;
      }
    }

    this.store.set(key, value, label, source);

    this.output({ key, label: label || key, source, success: true }, opts, (data) => {
      p.log.success(
        `${symbols.success} Stored ${theme.bold(data.key)} ${theme.dim(`(${data.source})`)}`
      );
    });
  }

  /**
   * Handle `mono secret get <key>`.
   *
   * @param args - [key]
   * @param opts - Global CLI options
   */
  private async handleGet(args: string[], opts: GlobalOptions): Promise<void> {
    const key = args[0];

    if (!key) {
      this.error('Usage: mono secret get <key>', opts);
      return;
    }

    const value = this.store.get(key);

    if (!value) {
      this.warn(`No secret found for "${key}"`, opts);
      return;
    }

    this.output({ key, value }, opts, (data) => {
      console.log(data.value);
    });
  }

  /**
   * Handle `mono secret list`.
   *
   * @param opts - Global CLI options
   */
  private async handleList(opts: GlobalOptions): Promise<void> {
    const secrets = this.store.list();

    if (secrets.length === 0) {
      this.warn('No secrets stored. Use `mono secret set <key>` to add one.', opts);
      return;
    }

    // Group by key
    const grouped = new Map<string, typeof secrets>();
    for (const entry of secrets) {
      const existing = grouped.get(entry.key) || [];
      existing.push(entry);
      grouped.set(entry.key, existing);
    }

    this.output(secrets, opts, () => {
      header('🔐 Stored Secrets');

      for (const [key, entries] of grouped) {
        console.log(`\n  ${theme.bold(key)} ${theme.dim(`(${entries.length} entries)`)}`);

        for (const entry of entries) {
          const defaultBadge = entry.isDefault ? theme.success(' ★ default') : '';
          const sourceBadge = entry.source !== 'manual' ? theme.info(` [${entry.source}]`) : '';
          console.log(
            `    ${symbols.bullet} ${entry.label}${defaultBadge}${sourceBadge} ${theme.dim(entry.createdAt.split('T')[0] || '')}`
          );
        }
      }

      console.log('');
    });
  }

  /**
   * Handle `mono secret delete <key>`.
   *
   * @param args - [key]
   * @param opts - Global CLI options
   */
  private async handleDelete(args: string[], opts: GlobalOptions): Promise<void> {
    const key = args[0];

    if (!key) {
      this.error('Usage: mono secret delete <key>', opts);
      return;
    }

    // Confirm deletion in interactive mode
    if (opts.interactive) {
      const confirmed = await p.confirm({
        message: `Delete all entries for "${key}"?`,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Cancelled.');
        return;
      }
    }

    const deleted = this.store.delete(key);

    this.output({ key, deleted }, opts, (data) => {
      if (data.deleted) {
        p.log.success(`${symbols.success} Deleted ${theme.bold(data.key)}`);
      } else {
        p.log.warn(`No secret found for "${data.key}"`);
      }
    });
  }

  /**
   * Handle `mono secret use <key> --default`.
   *
   * @param args - [key, --default]
   * @param opts - Global CLI options
   */
  private async handleUse(args: string[], opts: GlobalOptions): Promise<void> {
    const key = args[0];

    if (!key) {
      this.error('Usage: mono secret use <key> --default', opts);
      return;
    }

    const entries = this.store.getEntries(key);

    if (entries.length === 0) {
      this.warn(`No secret found for "${key}"`, opts);
      return;
    }

    let label: string | undefined;

    if (entries.length > 1 && opts.interactive) {
      const selected = await p.select({
        message: `Select default for ${theme.bold(key)}:`,
        options: entries.map((e) => ({
          value: e.label,
          label: e.label,
          hint: e.isDefault ? 'current default' : undefined,
        })),
      });

      if (p.isCancel(selected)) {
        p.cancel('Cancelled.');
        return;
      }

      label = selected;
    }

    const updated = this.store.setDefault(key, label);

    this.output({ key, label, updated }, opts, (data) => {
      if (data.updated) {
        p.log.success(
          `${symbols.success} Default for ${theme.bold(data.key)} set to ${theme.info(data.label || 'first entry')}`
        );
      } else {
        p.log.warn(`Could not update default for "${data.key}"`);
      }
    });
  }
}
