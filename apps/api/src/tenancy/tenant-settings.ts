import {
	type TurnstileSettings,
	runtimeSettings,
} from "../config/runtime-settings.js";
import { PRIMARY_TENANT_ID } from "./primary-tenant.js";
import { type LocalmanTenant, currentTenant } from "./tenant-context.js";

/** What differs per tenant (domain) among the runtime settings. */
export interface TenantSettings {
	/** Origin of the dashboard (links, redirect URIs). */
	readonly publicUrl: string;
	/** Mock URLs are `{secret}.{mockBaseDomain}`. */
	readonly mockBaseDomain: string;
	/** IdP subjects with admin rights in this tenant. */
	readonly ownerSubs: ReadonlySet<string>;
	/** Anti-spam of public forms; `null` without one. */
	readonly turnstile: TurnstileSettings | null;
	/** Guests (not signed in) may send the public forms. */
	readonly guestForms: boolean;
	/** Tunnel hosts are `<label>.<one of these>`. */
	readonly tunnelDomains: readonly string[];
	/**
	 * Feedback and requests alert the deployment owner's Telegram
	 * (`OWNER_TELEGRAM_CHAT_ID`); only the primary tenant's do.
	 */
	readonly ownerAlerts: boolean;
}

/**
 * Settings of the current tenant. The primary tenant keeps the process's
 * runtime settings (its environment); another tenant's follow from its
 * domain: `localman.<d>`, `tunnel.<d>`, owners from the IdP, no
 * Turnstile yet (its public forms are for signed-in users only) and no
 * alerts to the deployment owner (its entries stay on its admin page).
 */
export function tenantSettings(
	tenant: LocalmanTenant = currentTenant(),
): TenantSettings {
	const settings = runtimeSettings();
	if (tenant.id === PRIMARY_TENANT_ID) {
		return {
			publicUrl: settings.publicUrl,
			mockBaseDomain: settings.mockBaseDomain,
			ownerSubs: settings.ownerSubs,
			turnstile: settings.turnstile,
			guestForms: true,
			tunnelDomains: settings.tunnelDomains,
			ownerAlerts: true,
		};
	}
	return {
		publicUrl: tenant.publicUrl,
		mockBaseDomain: tenant.mockBaseDomain,
		ownerSubs: tenant.ownerSubs,
		turnstile: null,
		guestForms: false,
		tunnelDomains: [`tunnel.${tenant.domain}`],
		ownerAlerts: false,
	};
}
