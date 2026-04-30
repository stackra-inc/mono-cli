/**
 * CliRunner — bootstraps the CLI application.
 *
 * Creates the DI container via Application.create(), discovers
 * all @Command()-decorated classes, and registers them with Commander.
 * Handles the full lifecycle: parse → resolve → execute.
 *
 * After bootstrapping built-in commands, scans monorepos for
 * `mono.config.ts` files and registers custom commands as
 * `mono <repo>:<command>`.
 *
 * @module cli.runner
 * @since 1.0.0
 */

import { Command as Program } from 'commander';
import { Application } from '@stackra/ts-container';
import type { IApplication } from '@stackra/ts-container';
import { getCommandMetadata } from './decorators';
import { BaseCommand } from './commands/base.command';
import { CliModule } from './cli.module';
import { discoverMonorepos, findWorkspaceRoot } from './utils/detect';
import { loadMonoConfigs } from './utils/module-loader';
import type { GlobalOptions, CustomCommand, MonoConfig } from './types';

/**
 * All command classes registered in the CliModule.
 * Imported here so we can iterate over them to read metadata.
 */
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

/** All built-in command classes. */
const COMMAND_CLASSES = [
  StatusCommand,
  CleanCommand,
  BuildCommand,
  AboutCommand,
  RunCommand,
  GitStatusCommand,
  GitPushCommand,
  GraphCommand,
  FormatCommand,
  CreateCommand,
  SecretCommand,
  PublishCommand,
  SyncCommand,
  UpgradeCommand,
] as const;

/**
 * Loaded custom configs from monorepo mono.config.ts files.
 * Stored at module level so the AboutCommand can access them.
 */
export let loadedCustomConfigs: Array<{ repoName: string; config: MonoConfig }> = [];

/**
 * Bootstrap and run the CLI.
 *
 * 1. Creates the DI container from CliModule
 * 2. Reads @Command() metadata from each registered command class
 * 3. Registers each command with Commander
 * 4. Scans monorepos for mono.config.ts and registers custom commands
 * 5. Parses argv and executes the matched command
 */
export async function bootstrap(): Promise<void> {
  // 1. Create the DI container
  const app: IApplication = await Application.create(CliModule);

  // 2. Create the Commander program
  const program = new Program();

  program
    .name('mono')
    .description('⬡ Stackra — Universal Monorepo CLI')
    .version('1.1.0', '-v, --version')
    .option('--json', 'Output results as JSON', false)
    .option('--no-interactive', 'Disable interactive prompts (for CI)')
    .option('-r, --repo <repos...>', 'Target specific repo(s)')
    .option('--verbose', 'Enable verbose output', false);

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
      .description(meta.emoji ? `${meta.emoji}  ${meta.description}` : meta.description);

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
      const args = actionArgs.slice(0, -1).filter((a): a is string => typeof a === 'string');

      await instance.handle(args, getGlobalOpts());
    });
  }

  // 4. Scan monorepos for mono.config.ts and register custom commands
  try {
    const root = findWorkspaceRoot();
    const repos = discoverMonorepos(root);
    const configs = await loadMonoConfigs(repos);

    loadedCustomConfigs = configs.map(({ repo, config }) => ({
      repoName: repo.name,
      config,
    }));

    for (const { repo, config } of configs) {
      // Use the config name (short) as the namespace, with full repo name as alias
      const namespace = config.name; // e.g., "fe", "php", "rn"

      for (const customCmd of config.commands) {
        registerCustomCommand(program, namespace, repo.name, customCmd, getGlobalOpts);
      }
    }
  } catch {
    // Silently skip custom command loading on error
  }

  // 5. Parse and execute
  await program.parseAsync(process.argv);
}

/**
 * Register a custom command from a monorepo's mono.config.mjs.
 *
 * Custom commands use the config's short name as namespace:
 * `mono fe:build`, `mono php:migrate`, `mono rn:ios`
 *
 * Also registers the full repo name as an alias:
 * `mono frontend-monorepo:build` works too.
 *
 * @param program - The Commander program instance
 * @param namespace - Short namespace from config.name (e.g., "fe", "php", "rn")
 * @param repoName - Full monorepo directory name
 * @param customCmd - Custom command definition
 * @param getOpts - Function to extract global options
 */
function registerCustomCommand(
  program: InstanceType<typeof Program>,
  namespace: string,
  repoName: string,
  customCmd: CustomCommand,
  getOpts: () => GlobalOptions
): void {
  const shortName = `${namespace}:${customCmd.name}`;
  const fullName = `${repoName}:${customCmd.name}`;
  const emoji = customCmd.emoji || '🔌';

  const cmd = program.command(shortName).description(`${emoji}  ${customCmd.description}`);

  // Add full repo name as alias (so both work)
  if (shortName !== fullName) {
    cmd.alias(fullName);
  }

  // Add custom aliases with namespace prefix
  if (customCmd.aliases) {
    for (const alias of customCmd.aliases) {
      cmd.alias(`${namespace}:${alias}`);
    }
  }

  cmd.action(async () => {
    const opts = getOpts();

    if (typeof customCmd.action === 'function') {
      await customCmd.action();
    } else {
      // Shell command string — run it in the repo
      const { runCommand: run } = await import('./utils/runner.js');
      const { findWorkspaceRoot: findRoot, discoverMonorepos: discover } =
        await import('./utils/detect.js');

      const root = findRoot();
      const repos = discover(root);
      const repo = repos.find((r) => r.name === repoName);

      if (!repo) {
        console.error(`Repo "${repoName}" not found.`);
        process.exit(1);
      }

      const result = await run(customCmd.action, repo.path);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.stdout) console.log(result.stdout);
        if (result.stderr) console.error(result.stderr);
      }

      if (!result.success) process.exit(result.exitCode);
    }
  });
}
