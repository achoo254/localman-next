import type { BrandConfigWith } from "@shared-next/brand";
import config from "../../../brand.config.json" with { type: "json" };

/**
 * The product's brand.config.json, inlined at build time so the browser
 * bundle and the bundled API read it without the file system or a schema
 * validator. The annotation checks the file's shape when this compiles,
 * and the full schema runs in `pnpm check:brand` (part of `pnpm lint`),
 * `pnpm brand:gen` and scripts/brand/localman-brand.test.ts. Not wrapped in
 * `defineBrand`: its runtime check repeats those and would keep the whole
 * config plus the checker in the web bundle, where today the bundler keeps
 * only the fields the app reads.
 */
export const brand: BrandConfigWith<
	"webInstall" | "appIds.android" | "colors.primary" | "colors.backgroundDark"
> = config;
