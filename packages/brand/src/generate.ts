// Copied from chat-next/packages/brand @a5be0b4; keep in sync until shared package exists.
import type { BrandConfig } from "./brand-config.js";
import { manifestIcons } from "./icons.js";

/** Platform manifests derived from the brand, written to generated/. */
export interface GeneratedManifests {
	readonly "web.webmanifest.json": Record<string, unknown>;
	readonly "capacitor.json": Record<string, unknown>;
	readonly "tauri.json": Record<string, unknown>;
}

export function generateManifests(brand: BrandConfig): GeneratedManifests {
	return {
		"web.webmanifest.json": {
			// A stable identity: browsers treat the installed app as the same one across start_url changes.
			id: "/",
			name: brand.appName,
			short_name: brand.shortName,
			description: brand.description,
			// English is the source and default language of the web app.
			lang: "en",
			dir: "ltr",
			start_url: "/",
			scope: "/",
			display: "standalone",
			theme_color: brand.colors.primary,
			background_color: brand.colors.background,
			categories: ["productivity", "utilities"],
			prefer_related_applications: false,
			icons: manifestIcons(),
		},
		"capacitor.json": {
			appId: brand.appIds.ios,
			appName: brand.appName,
			android: { applicationId: brand.appIds.android },
			urlScheme: brand.urlScheme,
			// No server.hostname: the WebView keeps its own localhost origin. Using
			// the production host would make the local server answer the app's API
			// requests and pin one tenant into a binary that serves them all.
		},
		"tauri.json": {
			productName: brand.appName,
			identifier: brand.appIds.desktop,
			plugins: { "deep-link": { desktop: { schemes: [brand.urlScheme] } } },
		},
	};
}
