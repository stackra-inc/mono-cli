/**
 * @Command() decorator — marks a class as a CLI command.
 *
 * Stores command metadata (name, description, emoji, category, aliases)
 * on the class via reflect-metadata. The CliModule reads this metadata
 * to auto-register commands with Commander.
 *
 * @module decorators/command
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * @Command({
 *   name: 'build',
 *   description: 'Build all repos via turbo',
 *   emoji: '🔨',
 *   category: 'tasks',
 *   aliases: ['b'],
 * })
 * @Injectable()
 * class BuildCommand extends BaseCommand {
 *   async handle(opts: GlobalOptions): Promise<void> { ... }
 * }
 * ```
 */

import 'reflect-metadata';

/** Metadata key for command options stored on the class. */
export const COMMAND_METADATA = Symbol('command:metadata');

/**
 * Options for the @Command() decorator.
 */
export interface CommandOptions {
  /** Command name (e.g., 'build', 'clean', 'git:status') */
  name: string;

  /** Human-readable description shown in --help */
  description: string;

  /** Emoji prefix for display (e.g., '🔨', '🧹') */
  emoji?: string;

  /**
   * Category for grouping in help output.
   * Built-in categories: 'core', 'tasks', 'git', 'tools', 'custom'
   */
  category?: CommandCategory;

  /** Command aliases (e.g., ['b'] for 'build') */
  aliases?: string[];

  /** Positional arguments (e.g., '[mode]', '<task>') */
  args?: string;

  /** Whether this is the default command (runs when no command specified) */
  isDefault?: boolean;

  /** Whether this command is hidden from --help */
  hidden?: boolean;
}

/**
 * Built-in command categories for grouping in help output.
 */
export type CommandCategory =
  | 'core'
  | 'tasks'
  | 'git'
  | 'tools'
  | 'scaffold'
  | 'secrets'
  | 'custom';

/**
 * @Command() class decorator.
 *
 * Marks a class as a CLI command and stores its metadata.
 * Must be used together with `@Injectable()` from ts-container.
 *
 * @param options - Command configuration
 * @returns Class decorator
 */
export function Command(options: CommandOptions): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(COMMAND_METADATA, options, target);
  };
}

/**
 * Read command metadata from a decorated class.
 *
 * @param target - The class constructor
 * @returns Command options, or undefined if not decorated
 */
export function getCommandMetadata(target: Function): CommandOptions | undefined {
  return Reflect.getMetadata(COMMAND_METADATA, target);
}
