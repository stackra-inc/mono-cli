/**
 * @stackra/mono-cli — Universal CLI for Stackra monorepos.
 *
 * Entry point. Imports reflect-metadata (required for decorators),
 * then bootstraps the CLI application via the DI container.
 *
 * Architecture:
 * - `CliModule` registers all command classes as providers
 * - `@Command()` decorator stores metadata (name, description, emoji, category)
 * - `@Injectable()` enables constructor injection
 * - `BaseCommand` provides shared helpers (spinner, output, etc.)
 * - `CliRunner` reads metadata, wires Commander, and dispatches to handle()
 *
 * @packageDocumentation
 * @module @stackra/mono-cli
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono                          # show workspace status (default)
 * mono clean all                # clean everything
 * mono build                    # build all repos via turbo
 * mono about                    # show banner + info
 * mono --json status            # JSON output for CI
 * ```
 */

import 'reflect-metadata';

// Suppress Node.js MODULE_TYPELESS_PACKAGE_JSON warnings when loading
// mono.config.ts files from monorepos without "type": "module".
const _originalEmit = process.emit.bind(process);
process.emit = function (event: string, ...args: unknown[]) {
  if (
    event === 'warning' &&
    typeof args[0] === 'object' &&
    args[0] !== null &&
    'name' in args[0] &&
    (args[0] as { name: string }).name === 'MODULE_TYPELESS_PACKAGE_JSON'
  ) {
    return false;
  }
  return _originalEmit(event, ...args);
};

import { bootstrap } from './cli.runner';

bootstrap().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
