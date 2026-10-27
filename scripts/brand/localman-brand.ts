/**
 * How Localman calls @achoo254/brand at build time: the fields it cannot
 * work without, the manifests it generates and where they go. Shared by
 * `pnpm brand:gen` (scripts/brand-gen.ts) and the tests that keep the
 * committed files equal to what it would write.
 */
import {
	type BrandConfigWith,
	type GenerateManifestsOptions,
	type JsonIndent,
	type RequirableField,
	loadBrandConfig,
	svgManifestIcons,
} from "@achoo254/brand/build";

/** Repository root: the directory of brand.config.json and its icon paths. */
export const BRAND_ROOT = new URL("../../", import.meta.url);

/** Where `pnpm brand:gen` writes; apps/web serves the icons from its icons/. */
export const GENERATED_DIR = new URL("packages/brand/generated/", BRAND_ROOT);

/**
 * Optional schema fields Localman relies on: the web install switch, the
 * Android id of the Capacitor app and the colours of the design tokens.
 */
export const BRAND_REQUIRE = [
	"webInstall",
	"appIds.android",
	"colors.primary",
	"colors.backgroundDark",
] as const satisfies readonly RequirableField[];

export type LocalmanBrand = BrandConfigWith<(typeof BRAND_REQUIRE)[number]>;

/** Biome formats the repository with tabs; the generated JSON follows. */
export const BRAND_INDENT: JsonIndent = "\t";

export const BRAND_MANIFESTS: GenerateManifestsOptions = {
	web: {
		// A stable identity: browsers treat the installed app as the same one across start_url changes.
		id: "/",
		// English is the source and default language of the web app.
		lang: "en",
		dir: "ltr",
		themeColor: "primary",
		categories: ["productivity", "utilities"],
		preferRelatedApplications: false,
		icons: svgManifestIcons(),
	},
	capacitor: true,
};

/** Reads brand.config.json and validates it against the schema and BRAND_REQUIRE. */
export function loadLocalmanBrand(): LocalmanBrand {
	return loadBrandConfig(BRAND_ROOT, { require: BRAND_REQUIRE });
}
