/**
 * CliRunner — bootstraps the CLI application.
 *
 * Creates the DI container via Application.create(), discovers
 * all @Command()-decorated classes, and registers them with Commander.
 * Handles the full lifecycle: parse → resolve → execute.
 *
 * @module cli.runner
 * @since 0.1.0
 */

import { Command as Program } from "commander";
import { Application } from "@stackra/ts-container";
import type { IApplication } from "@stackra/ts-container";
import { getCommandMetadata } from "./decorators";
import { BaseCommand } from "./commands/base.command.js";
import { CliModule } from "./cli.module.js";
import type { GlobalOptions } from "./types";

/**
 * All command classes registered in the CliModule.
 * Imported here so we can iterate over them to read metadata.
 */
import { StatusCommand } from "./commands/status.command.js";
import { CleanCommand } from "./commands/clean.command.js";
import { BuildCommand } from "./commands/build.command.js";
import { AboutCommand } from "./commands/about.command.js";

/** All built-in command classes. */
const COMMAND_CLASSES = [
  StatusCommand,
  CleanCommand,
  BuildCommand,
  AboutCommand,
] as const;

/**
 * Bootstrap and run the CLI.
 *
 * 1. Creates the DI container from CliModule
 * 2. Reads @Command() metadata from each registered command class
 * 3. Registers each command with Commander
 * 4. Parses argv and executes the matched command
 */
export async function bootstrap(): Promise<void> {
  // 1. Create the DI container
  const app: IApplication = await Application.create(CliModule);

  // 2. Create the Commander program
  const program = new Program();

  program
    .name("mono")
    .description("⬡ Stackra — Universal Monorepo CLI")
    .version("0.1.0", "-v, --version")
    .option("--json", "Output results as JSON", false)
    .option("--no-interactive", "Disable interactive prompts (for CI)")
    .option("-r, --repo <repos...>", "Target specific repo(s)")
    .option("--verbose", "Enable verbose output", false);

  /**
   * Extract global options from the program.
   */
  function getGlobalOpts(): GlobalOptions {
    const opts = program.opts();
    return {
      json: opts.json ?? false,
      interactive: opts.interactive ?? true,
      repo: opts.repo,
      verbose: opts.verbose ?? false,
    };
  }

  // 3. Register each command from the DI container
  for (const CommandClass of COMMAND_CLASSES) {
    const meta = getCommandMetadata(CommandClass);
    if (!meta) continue;

    /** Resolve the command instance from the DI container. */
    const instance = app.get<BaseCommand>(CommandClass);

    /** Build the Commander command. */
    const cmd = program
      .command(meta.args ? `${meta.name} ${meta.args}` : meta.name, {
        isDefault: meta.isDefault,
        hidden: meta.hidden,
      })
      .description(
        meta.emoji ? `${meta.emoji}  ${meta.description}` : meta.description,
      );

    /** Register aliases. */
    if (meta.aliases) {
      for (const alias of meta.aliases) {
        cmd.alias(alias);
      }
    }

    /** Wire the action to the command instance's handle() method. */
    cmd.action(async (...actionArgs: unknown[]) => {
      // Commander passes positional args then the Command object
      // We extract just the string args
      const args = actionArgs
        .slice(0, -1)
        .filter((a): a is string => typeof a === "string");

      await instance.handle(args, getGlobalOpts());
    });
  }

  // 4. Parse and execute
  await program.parseAsync(process.argv);
}
