/**
 * BaseCommand — abstract base class for all CLI commands.
 *
 * Every command in the CLI extends this class. It provides:
 * - Access to the global options (--json, --repo, --verbose, etc.)
 * - A standard `handle()` method that subclasses implement
 * - Helper methods for common patterns (spinners, output, etc.)
 *
 * The @Command() decorator provides metadata (name, description, emoji),
 * and @Injectable() enables constructor injection of services.
 *
 * @module commands/base
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * @Command({
 *   name: 'status',
 *   description: 'Show workspace overview',
 *   emoji: '📊',
 *   category: 'core',
 * })
 * @Injectable()
 * class StatusCommand extends BaseCommand {
 *   constructor(private detector: MonorepoDetector) {
 *     super();
 *   }
 *
 *   async handle(args: string[], opts: GlobalOptions): Promise<void> {
 *     const repos = this.detector.discover();
 *     // ...
 *   }
 * }
 * ```
 */

import * as p from '@clack/prompts';

import type { GlobalOptions } from '@/types';

/**
 * Abstract base class for all CLI commands.
 *
 * Subclasses must implement the `handle()` method.
 * The @Command() decorator provides the command metadata.
 */
export abstract class BaseCommand {
  /**
   * Execute the command.
   *
   * @param args - Positional arguments from the CLI
   * @param opts - Global CLI options (--json, --repo, --verbose, etc.)
   */
  abstract handle(args: string[], opts: GlobalOptions): Promise<void>;

  // ── Helper Methods ───────────────────────────────────────────────

  /**
   * Create and return a clack spinner.
   * Returns null if in JSON mode (no visual output).
   *
   * @param opts - Global options to check for JSON mode
   * @returns Spinner instance or null
   */
  protected spinner(opts: GlobalOptions) {
    return opts.json ? null : p.spinner();
  }

  /**
   * Log a success message with a checkmark.
   *
   * @param message - Message to display
   * @param opts - Global options (suppressed in JSON mode)
   */
  protected success(message: string, opts: GlobalOptions): void {
    if (!opts.json) {
      p.log.success(message);
    }
  }

  /**
   * Log a warning message.
   *
   * @param message - Message to display
   * @param opts - Global options (suppressed in JSON mode)
   */
  protected warn(message: string, opts: GlobalOptions): void {
    if (!opts.json) {
      p.log.warn(message);
    }
  }

  /**
   * Log an error message.
   *
   * @param message - Message to display
   * @param opts - Global options (suppressed in JSON mode)
   */
  protected error(message: string, opts: GlobalOptions): void {
    if (!opts.json) {
      p.log.error(message);
    }
  }

  /**
   * Log an info message.
   *
   * @param message - Message to display
   * @param opts - Global options (suppressed in JSON mode)
   */
  protected info(message: string, opts: GlobalOptions): void {
    if (!opts.json) {
      p.log.info(message);
    }
  }

  /**
   * Output data — JSON if --json flag, otherwise use the formatter.
   *
   * @param data - Data to output
   * @param opts - Global options
   * @param formatter - Human-readable formatter function
   */
  protected output<T>(data: T, opts: GlobalOptions, formatter: (data: T) => void): void {
    if (opts.json) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      formatter(data);
    }
  }
}
