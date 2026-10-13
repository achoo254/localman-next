import {
	type TenancyLogger,
	createIdpTenantApi,
	dropReplacedIndexes,
	tagUntaggedDocuments,
} from "@localman/tenancy";
import mongoose from "mongoose";
import type { AuthConfig } from "../config/auth-config.js";
import { PRIMARY_TENANT_ID, primaryTenantFromEnv } from "./primary-tenant.js";
import {
	configureTenants,
	idpTenantDirectory,
	singleTenantDirectory,
} from "./tenant-directory.js";

/** How Tunelo reaches the IdP for tenants other than the primary one. */
export interface TenantIdpSettings {
	/** `IDP_INTERNAL_URL`: the IdP's internal API on loopback. */
	readonly internalUrl: string;
	/** `IDP_INTERNAL_SECRET`: Tunelo's `tunelo:<secret>` entry of it. */
	readonly internalSecret: string;
	/** `IDP_LOOPBACK_URL` + `TUNELO_CLIENT_KEY`: the web console of tenants. */
	readonly web?: { readonly loopbackUrl: string; readonly clientKey: string };
}

/** Reads the tenant settings; both or neither of the internal API pair. */
export function tenantIdpSettings(
	env: NodeJS.ProcessEnv = process.env,
): TenantIdpSettings | undefined {
	const { IDP_INTERNAL_URL, IDP_INTERNAL_SECRET } = env;
	if (!IDP_INTERNAL_URL && !IDP_INTERNAL_SECRET) return undefined;
	if (
		!IDP_INTERNAL_URL ||
		!IDP_INTERNAL_SECRET ||
		IDP_INTERNAL_SECRET.length < 32
	) {
		throw new Error(
			"IDP_INTERNAL_URL and IDP_INTERNAL_SECRET (32+ characters) go together",
		);
	}
	const { IDP_LOOPBACK_URL, TUNELO_CLIENT_KEY } = env;
	const web =
		IDP_LOOPBACK_URL && TUNELO_CLIENT_KEY
			? {
					loopbackUrl: new URL(IDP_LOOPBACK_URL).origin,
					clientKey: TUNELO_CLIENT_KEY,
				}
			: undefined;
	return {
		internalUrl: new URL(IDP_INTERNAL_URL).origin,
		internalSecret: IDP_INTERNAL_SECRET,
		web,
	};
}

/**
 * Installs the tenant directory: without the IdP's internal API, the
 * primary tenant serves its own and loopback hosts (Tunelo before
 * tenants); with it, other `tunnel.<domain>` hosts are the IdP's tenants.
 */
export function configureTenancy(
	auth: AuthConfig,
	settings: TenantIdpSettings | undefined,
	logger: TenancyLogger,
): void {
	const primary = primaryTenantFromEnv(auth);
	if (!settings) {
		configureTenants(singleTenantDirectory(primary));
		return;
	}
	const api = createIdpTenantApi({
		origin: settings.internalUrl,
		role: "tunelo",
		secret: settings.internalSecret,
	});
	configureTenants(idpTenantDirectory({ primary, api, logger }));
}

/**
 * After connecting: documents stored before tenants get the primary
 * tenant, every index (tenant-prefixed) is built, and the indexes they
 * replace go once other tenants are served (a rollback before that needs
 * no index build).
 */
export async function migrateToTenants(
	logger: TenancyLogger,
	multiTenant: boolean,
): Promise<void> {
	await tagUntaggedDocuments(logger, PRIMARY_TENANT_ID);
	await Promise.all(
		mongoose.modelNames().map((name) => mongoose.model(name).init()),
	);
	if (multiTenant) await dropReplacedIndexes(logger);
}
