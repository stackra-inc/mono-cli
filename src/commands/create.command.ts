/**
 * CreateCommand — interactive scaffolding for apps and packages.
 *
 * Guides the user through creating a new app or package in
 * a monorepo, with ecosystem-specific options for Vite, Next.js,
 * Expo, Laravel, and more.
 *
 * @module commands/create
 * @since 1.0.0
 *
 * @example
 * ```bash
 * mono create                    # interactive mode
 * mono create app my-app         # create app named my-app
 * mono create package my-pkg     # create package named my-pkg
 * ```
 */

import * as p from '@clack/prompts';
import { Injectable } from '@stackra/ts-container';

import { Command } from '@/decorators';
import { BaseCommand } from './base.command';
import type { GlobalOptions, MonorepoInfo } from '@/types';
import { discoverMonorepos, findWorkspaceRoot, runCommand } from '@/utils';
import { theme, symbols } from '@/utils/ui';

/** Scaffold type — app or package. */
type ScaffoldType = 'app' | 'package';

/** Node app framework options. */
type NodeFramework = 'vite' | 'nextjs' | 'expo' | 'none';

/** PHP app framework options. */
type PhpFramework = 'laravel' | 'none';

/** Framework scaffold commands. */
const FRAMEWORK_COMMANDS: Record<string, string> = {
  vite: 'pnpm create vite',
  nextjs: 'pnpm create next-app',
  expo: 'pnpm create expo-app',
  laravel: 'composer create-project laravel/laravel',
};

/**
 * Interactive scaffolding command.
 *
 * Walks the user through creating a new app or package,
 * selecting the target monorepo, and choosing framework options.
 */
@Command({
  name: 'create',
  description: 'Scaffold a new app or package',
  emoji: '🏗️',
  category: 'scaffold',
  args: '[type] [name]',
})
@Injectable()
export class CreateCommand extends BaseCommand {
  /**
   * Execute the create command.
   *
   * @param args - [type, name] — optional positional args
   * @param opts - Global CLI options
   */
  async handle(args: string[], opts: GlobalOptions): Promise<void> {
    const root = findWorkspaceRoot();
    const repos = discoverMonorepos(root);

    if (repos.length === 0) {
      this.warn('No monorepos found in the workspace.', opts);
      return;
    }

    if (!opts.json) {
      p.intro(theme.primary('  🏗️  Create  '));
    }

    // 1. Resolve scaffold type
    let scaffoldType: ScaffoldType;
    const typeArg = args[0];

    if (typeArg === 'app' || typeArg === 'package') {
      scaffoldType = typeArg;
    } else if (opts.interactive) {
      const selected = await p.select({
        message: 'What do you want to create?',
        options: [
          { value: 'app' as ScaffoldType, label: '📱 App', hint: 'A new application' },
          { value: 'package' as ScaffoldType, label: '📦 Package', hint: 'A shared library' },
        ],
      });

      if (p.isCancel(selected)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }

      scaffoldType = selected;
    } else {
      this.error('Please specify a type: mono create <app|package> [name]', opts);
      return;
    }

    // 2. Resolve name
    let name = args[1];

    if (!name && opts.interactive) {
      const input = await p.text({
        message: `${scaffoldType === 'app' ? 'App' : 'Package'} name:`,
        placeholder: scaffoldType === 'app' ? 'my-app' : 'my-package',
        validate: (val) => {
          if (!val || val.length === 0) return 'Name is required';
          if (!/^[a-z0-9-]+$/.test(val)) return 'Use lowercase letters, numbers, and hyphens only';
          return undefined;
        },
      });

      if (p.isCancel(input)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }

      name = input;
    }

    if (!name) {
      this.error('Please specify a name: mono create <type> <name>', opts);
      return;
    }

    // 3. Select target monorepo
    let targetRepo: MonorepoInfo;

    if (repos.length === 1) {
      targetRepo = repos[0]!;
    } else if (opts.interactive) {
      const selected = await p.select({
        message: 'Target monorepo:',
        options: repos.map((r) => ({
          value: r.name,
          label: r.name,
          hint: r.ecosystems.join(', '),
        })),
      });

      if (p.isCancel(selected)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }

      targetRepo = repos.find((r) => r.name === selected)!;
    } else if (opts.repo?.[0]) {
      const found = repos.find((r) => r.name.includes(opts.repo![0]!));
      if (!found) {
        this.error(`Repo "${opts.repo[0]}" not found.`, opts);
        return;
      }
      targetRepo = found;
    } else {
      this.error('Multiple repos found. Use --repo to specify target, or run interactively.', opts);
      return;
    }

    // 4. Determine framework
    let framework = 'none';

    if (scaffoldType === 'app' && opts.interactive) {
      if (targetRepo.ecosystems.includes('node')) {
        const selected = await p.select({
          message: 'Framework:',
          options: [
            { value: 'vite' as NodeFramework, label: '⚡ Vite', hint: 'Fast build tool' },
            { value: 'nextjs' as NodeFramework, label: '▲ Next.js', hint: 'React framework' },
            { value: 'expo' as NodeFramework, label: '📱 Expo', hint: 'React Native' },
            { value: 'none' as NodeFramework, label: '📁 Empty', hint: 'Blank project' },
          ],
        });

        if (p.isCancel(selected)) {
          p.cancel('Cancelled.');
          process.exit(0);
        }

        framework = selected;
      } else if (targetRepo.ecosystems.includes('php')) {
        const selected = await p.select({
          message: 'Framework:',
          options: [
            { value: 'laravel' as PhpFramework, label: '🐘 Laravel', hint: 'PHP framework' },
            { value: 'none' as PhpFramework, label: '📁 Empty', hint: 'Blank project' },
          ],
        });

        if (p.isCancel(selected)) {
          p.cancel('Cancelled.');
          process.exit(0);
        }

        framework = selected;
      }
    }

    // 5. Execute scaffold
    const targetDir = scaffoldType === 'app' ? 'apps' : 'packages';
    const fullPath = `${targetRepo.path}/${targetDir}`;

    if (!opts.json) {
      console.log('');
      this.info(`${theme.muted('Type:')} ${scaffoldType}`, opts);
      this.info(`${theme.muted('Name:')} ${name}`, opts);
      this.info(`${theme.muted('Repo:')} ${targetRepo.name}`, opts);
      this.info(`${theme.muted('Path:')} ${targetDir}/${name}`, opts);
      if (framework !== 'none') {
        this.info(`${theme.muted('Framework:')} ${framework}`, opts);
      }
    }

    const s = this.spinner(opts);
    s?.start(`Creating ${scaffoldType} ${theme.bold(name)}...`);

    let result;

    if (framework !== 'none' && FRAMEWORK_COMMANDS[framework]) {
      const cmd = `${FRAMEWORK_COMMANDS[framework]} ${name}`;
      result = await runCommand(cmd, fullPath);
    } else {
      // Create a basic directory structure
      result = await runCommand(`mkdir -p ${name}/src`, fullPath);
    }

    if (!opts.json) {
      if (result.success) {
        s?.stop(`${symbols.success} Created ${theme.bold(name)} in ${targetDir}/`);
      } else {
        s?.stop(`${symbols.error} Failed to create ${name}`);
        if (opts.verbose) {
          console.log(theme.error(result.stderr.slice(-500)));
        }
      }
    }

    this.output(
      {
        type: scaffoldType,
        name,
        repo: targetRepo.name,
        path: `${targetDir}/${name}`,
        framework,
        success: result.success,
      },
      opts,
      (data) => {
        console.log('');
        p.outro(
          data.success
            ? theme.success(`${symbols.success} ${data.name} is ready!`)
            : theme.error('Scaffold failed — check output above')
        );
      }
    );
  }
}
