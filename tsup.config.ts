/**
 * tsup build configuration for @stackra/mono-cli.
 *
 * Produces a single ESM executable with a shebang line
 * so it can be invoked directly as `mono`.
 *
 * @module tsup.config
 */

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  outDir: "dist",
});
