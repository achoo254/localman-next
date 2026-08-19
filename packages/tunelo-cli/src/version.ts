/**
 * Single source of truth for the CLI version.
 * Must match packages/client/package.json — version.test.ts fails the build if it drifts.
 */
export const VERSION = "1.6.1";

/** npm package name, used by `tunelo update` to talk to the registry */
export const PACKAGE_NAME = "@dattqh/tunelo";
