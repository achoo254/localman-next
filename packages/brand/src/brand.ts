import config from "../../../brand.config.json" with { type: "json" };
import type { BrandConfig } from "./brand-config.js";

/**
 * brand.config.json, inlined at build time so the browser bundle and the
 * bundled API read it without the file system or a schema validator. The
 * schema is enforced by `pnpm lint` (scripts/check-brand.ts) and the tests
 * of this package, which load the same file through `loadBrandConfig`.
 */
export const brand: BrandConfig = config;
