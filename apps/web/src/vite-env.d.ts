/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Absolute origin of the Localman API; empty means same origin. */
	readonly VITE_API_BASE_URL?: string;
	/** Origin of the identity provider (account pages). */
	readonly VITE_IDP_ORIGIN?: string;
	/** Released features, comma-separated (see src/config/features.ts). */
	readonly VITE_FEATURES?: string;
}
