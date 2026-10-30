import { useSyncExternalStore } from "react";
import { apiRequest } from "./api-client";
import { appConfig } from "./app-config";
import { expectRecord, expectString, optionalString } from "./json-guards";

/** The domain this Localman is served on (`GET /api/v1/tenant`). */
export interface TenantInfo {
	/** Name of the account people sign in with ("hoandat.com", "Acme"). */
	readonly displayName: string;
	readonly idpOrigin: string;
	/** Dashboard origin, e.g. `https://localman.hoandat.com`. */
	readonly publicUrl: string;
	/** Mock URLs are `https://{secret}.{mockBaseDomain}{prefix}`. */
	readonly mockBaseDomain: string;
	readonly tunnelDomain: string | null;
}

/**
 * What the prerendered pages and the first render show, until the API
 * answers: the primary domain (the build's IdP).
 */
export const DEFAULT_TENANT_INFO: TenantInfo = {
	displayName: "hoandat.com",
	idpOrigin: appConfig.idpOrigin,
	publicUrl: "https://localman.hoandat.com",
	mockBaseDomain: "localman.hoandat.com",
	tunnelDomain: "tunnel.hoandat.com",
};

export async function fetchTenantInfo(): Promise<TenantInfo> {
	const data = expectRecord(
		await apiRequest("/api/v1/tenant", { redirectOnUnauthorized: false }),
		"tenant info",
	);
	return {
		displayName: expectString(data, "displayName"),
		idpOrigin: expectString(data, "idpOrigin"),
		publicUrl: expectString(data, "publicUrl"),
		mockBaseDomain: expectString(data, "mockBaseDomain"),
		tunnelDomain: optionalString(data, "tunnelDomain"),
	};
}

let loaded: TenantInfo | undefined;
let loading = false;
const listeners = new Set<() => void>();

/** Reads the domain once per page load; a failure keeps the defaults. */
function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	if (!loaded && !loading) {
		loading = true;
		fetchTenantInfo().then(
			(info) => {
				loaded = info;
				for (const notify of listeners) notify();
			},
			() => {
				// Defaults stay; the next page component to mount asks again.
				loading = false;
			},
		);
	}
	return () => listeners.delete(listener);
}

/**
 * The domain's account name and hosts; the defaults until the API answers
 * (and if it cannot), so prerendered markup hydrates unchanged.
 */
export function useTenantInfo(): TenantInfo {
	return useSyncExternalStore(
		subscribe,
		() => loaded ?? DEFAULT_TENANT_INFO,
		() => DEFAULT_TENANT_INFO,
	);
}

/**
 * The domain's account name and hosts once the API has answered; null
 * before that, in prerendered markup and while the API cannot answer. For
 * what must never show the primary domain's defaults on another tenant.
 */
export function useLoadedTenantInfo(): TenantInfo | null {
	return useSyncExternalStore(
		subscribe,
		() => loaded ?? null,
		() => null,
	);
}

/** IdP page for linked sign-in methods (Google, GitHub, Apple, Telegram) and sessions. */
export function idpAccountUrlOf(info: TenantInfo): string {
	return `${info.idpOrigin}/account`;
}

/** IdP page that deletes the sign-in account itself (not Localman's data). */
export function idpAccountDeleteUrlOf(info: TenantInfo): string {
	return `${idpAccountUrlOf(info)}/delete`;
}
