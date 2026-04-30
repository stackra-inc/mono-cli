/**
 * CliModule — the root module for the CLI application.
 *
 * Registers all built-in commands and services using @stackra/ts-container.
 * External monorepos can register custom commands via the static
 * `CliModule.register()` method in their `mono.config.ts` file.
 *
 * @module cli.module
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * // Bootstrap the CLI
 * const app = await Application.create(CliModule);
 * ```
 *
 * @example
 * ```typescript
 * // mono.config.ts in a monorepo
 * import { CliModule } from '@stackra/mono-cli';
 *
 * export default CliModule.register({
 *   name: 'frontend',
 *   commands: [
 *     {
 *       name: 'storybook',
 *       description: 'Start Storybook dev server',
 *       emoji: '📖',
 *       action: 'pnpm storybook',
 *     },
 *   ],
 * });
 * ```
 */

import { Module } from '@stackra/ts-container';
import type { MonoConfig, CustomCommand } from '@/types';

// ── Commands ─────────────────────────────────────────────────────────
import { StatusCommand } from './commands/status.command';
import { CleanCommand } from './commands/clean.command';
import { BuildCommand } from './commands/build.command';
import { AboutCommand } from './commands/about.command';
import { RunCommand } from './commands/run.command';
import { GitStatusCommand } from './commands/git-status.command';
import { GitPushCommand } from './commands/git-push.command';
import { GraphCommand } from './commands/graph.command';
import { FormatCommand } from './commands/format.command';
import { CreateCommand } from './commands/create.command';
import { SecretCommand } from './commands/secret.command';
import { PublishCommand } from './commands/publish.command';
import { SyncCommand } from './commands/sync.command';
import { UpgradeCommand } from './commands/upgrade.command';

// ── Services ─────────────────────────────────────────────────────────
import { SecretStore } from './services/secret-store';

/**
 * Root CLI module.
 *
 * All built-in commands and services are registered as providers.
 * The CliRunner resolves them and registers with Commander.
 */
@Module({
  providers: [
    // Services
    SecretStore,
    // Core commands
    StatusCommand,
    CleanCommand,
    BuildCommand,
    AboutCommand,
    // Task commands
    RunCommand,
    FormatCommand,
    // Git commands
    GitStatusCommand,
    GitPushCommand,
    // Tool commands
    GraphCommand,
    PublishCommand,
    SyncCommand,
    UpgradeCommand,
    // Scaffold commands
    CreateCommand,
    // Secret commands
    SecretCommand,
  ],
  exports: [
    SecretStore,
    StatusCommand,
    CleanCommand,
    BuildCommand,
    AboutCommand,
    RunCommand,
    FormatCommand,
    GitStatusCommand,
    GitPushCommand,
    GraphCommand,
    PublishCommand,
    SyncCommand,
    UpgradeCommand,
    CreateCommand,
    SecretCommand,
  ],
})
export class CliModule {
  /**
   * Register custom commands from a monorepo's `mono.config.ts`.
   *
   * This is the public API for monorepos to extend the CLI with
   * their own commands. Returns a `MonoConfig` object that the
   * CLI runner discovers and loads at bootstrap time.
   *
   * Custom commands are namespaced as `mono <repoName>:<commandName>`
   * and appear in `mono about` under the repo's section.
   *
   * @param config - The monorepo's custom command configuration
   * @returns The validated MonoConfig (passthrough for mono.config.ts default export)
   *
   * @example
   * ```typescript
   * // frontend-monorepo/mono.config.ts
   * import { CliModule } from '@stackra/mono-cli';
   *
   * export default CliModule.register({
   *   name: 'frontend',
   *   description: 'Frontend monorepo commands',
   *   commands: [
   *     {
   *       name: 'storybook',
   *       description: 'Start Storybook dev server',
   *       emoji: '📖',
   *       action: 'pnpm storybook',
   *     },
   *     {
   *       name: 'deploy:preview',
   *       description: 'Deploy to Vercel preview',
   *       emoji: '🚀',
   *       action: 'vercel deploy --prebuilt',
   *       aliases: ['dp'],
   *     },
   *     {
   *       name: 'analyze',
   *       description: 'Analyze bundle size',
   *       emoji: '📊',
   *       action: async () => {
   *         console.log('Running bundle analysis...');
   *         // Custom async logic here
   *       },
   *     },
   *   ],
   * });
   * ```
   *
   * @example
   * ```typescript
   * // php-monorepo/mono.config.ts
   * import { CliModule } from '@stackra/mono-cli';
   *
   * export default CliModule.register({
   *   name: 'php',
   *   commands: [
   *     {
   *       name: 'migrate',
   *       description: 'Run database migrations',
   *       emoji: '🗄️',
   *       action: 'php artisan migrate',
   *     },
   *     {
   *       name: 'seed',
   *       description: 'Seed the database',
   *       emoji: '🌱',
   *       action: 'php artisan db:seed',
   *     },
   *     {
   *       name: 'tinker',
   *       description: 'Open Laravel Tinker REPL',
   *       emoji: '🔧',
   *       action: 'php artisan tinker',
   *     },
   *   ],
   * });
   * ```
   */
  static register(config: MonoConfig): MonoConfig {
    // Validate required fields
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('[CliModule.register] config.name is required and must be a string');
    }

    if (!Array.isArray(config.commands)) {
      throw new Error('[CliModule.register] config.commands is required and must be an array');
    }

    // Validate each command
    for (const cmd of config.commands) {
      CliModule.validateCommand(cmd, config.name);
    }

    return config;
  }

  /**
   * Validate a single custom command definition.
   *
   * @param cmd - The command to validate
   * @param repoName - The repo name (for error messages)
   * @throws Error if the command is invalid
   */
  private static validateCommand(cmd: CustomCommand, repoName: string): void {
    if (!cmd.name || typeof cmd.name !== 'string') {
      throw new Error(`[CliModule.register] Command in "${repoName}" is missing a name`);
    }

    if (!cmd.description || typeof cmd.description !== 'string') {
      throw new Error(
        `[CliModule.register] Command "${repoName}:${cmd.name}" is missing a description`
      );
    }

    if (!cmd.action) {
      throw new Error(
        `[CliModule.register] Command "${repoName}:${cmd.name}" is missing an action`
      );
    }

    if (typeof cmd.action !== 'string' && typeof cmd.action !== 'function') {
      throw new Error(
        `[CliModule.register] Command "${repoName}:${cmd.name}" action must be a string or function`
      );
    }
  }
}
