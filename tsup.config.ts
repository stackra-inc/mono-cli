/**
 * @fileoverview tsup build configuration for @stackra/mono-cli
 * @module @stackra/mono-cli
 * @see https://tsup.egoist.dev/
 */

import { basePreset as preset } from "@stackra/tsup-config";

export default {
  platform: "node",
  banner: {
    js: "#!/usr/bin/env node",
  },
  ...preset,
};
