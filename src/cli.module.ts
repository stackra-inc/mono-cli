/**
 * CliModule — the root module for the CLI application.
 *
 * Registers all built-in commands and services using @stackra/ts-container.
 * External monorepos can extend this by providing a `mono.config.ts` that
 * registers additional commands.
 *
 * @module cli.module
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * // Bootstrap the CLI
 * const app = await Application.create(CliModule);
 * const runner = app.get(CliRunner);
 * await runner.run(process.argv);
 * ```
 */

import { Module } from '@stackra/ts-container';
import { StatusCommand } from './commands/status.command';
import { CleanCommand } from './commands/clean.command';
import { BuildCommand } from './commands/build.command';
import { AboutCommand } from './commands/about.command';

/**
 * Root CLI module.
 *
 * All built-in commands are registered as providers.
 * The CliRunner resolves them and registers with Commander.
 */
@Module({
  providers: [StatusCommand, CleanCommand, BuildCommand, AboutCommand],
  exports: [StatusCommand, CleanCommand, BuildCommand, AboutCommand],
})
export class CliModule {}
