import {
	type TurnstileSettings,
	runtimeSettings,
} from "../config/runtime-settings.js";

/** The domain settings Localman serves under, from the runtime settings. */
export interface TenantSettings {
	/** Origin of the dashboard (links, redirect URIs). */
	readonly publicUrl: string;
	/** Mock URLs are `{secret}.{mockBaseDomain}`. */
	readonly mockBaseDomain: string;
	/** IdP subjects with admin rights. */
	readonly ownerSubs: ReadonlySet<string>;
	/** Anti-spam of public forms; `null` without one. */
	readonly turnstile: TurnstileSettings | null;
	/** Tunnel hosts are `<label>.<one of these>`. */
	readonly tunnelDomains: readonly string[];
}

/**
 * Settings of the primary tenant, the only one served: the process's
 * runtime settings (its environment).
 */
export function tenantSettings(): TenantSettings {
	const settings = runtimeSettings();
	return {
		publicUrl: settings.publicUrl,
		mockBaseDomain: settings.mockBaseDomain,
		ownerSubs: settings.ownerSubs,
		turnstile: settings.turnstile,
		tunnelDomains: settings.tunnelDomains,
	};
}
