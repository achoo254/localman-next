import { AsyncLocalStorage } from "node:async_hooks";
import mongoose from "mongoose";
import { MissingTenantError } from "./tenant-errors.js";

/**
 * One tenant Localman serves: a domain claimed at the IdP. Its dashboard
 * is `localman.<domain>`, its mocks `*.localman.<domain>`, its users sign
 * in at `https://auth.<domain>`. Every document carries its `id`.
 */
export interface LocalmanTenant {
	/** The IdP's tenant id (`primary` for hoandat.com, `ten_…` otherwise). */
	readonly id: string;
	readonly domain: string;
	readonly displayName: string;
	readonly issuer: string;
	/** Origin of the web app and dashboard API. */
	readonly publicUrl: string;
	/** Mock URLs are `{secret}.{mockBaseDomain}`. */
	readonly mockBaseDomain: string;
	/** IdP subjects allowed on admin operations in this tenant. */
	readonly ownerSubs: ReadonlySet<string>;
}

interface Scope {
	/** Whose data queries and writes are limited to. */
	readonly tenantId?: string;
	/** The tenant's settings; absent in a data-only scope (ops commands). */
	readonly tenant?: LocalmanTenant;
	/** A job listing work across tenants (tenant-scope-plugin skips the filter). */
	readonly allTenants?: true;
}

const storage = new AsyncLocalStorage<Scope>();
let testDefault: LocalmanTenant | undefined;

/**
 * A mongoose query or aggregation runs when awaited, so one returned
 * unawaited would run after the scope, in the caller's: refused.
 */
function inScope<T>(scope: Scope, fn: () => T): T {
	const result = storage.run(scope, fn);
	if (
		result instanceof mongoose.Query ||
		result instanceof mongoose.Aggregate
	) {
		throw new TypeError(
			"Await the query inside the tenant scope (use .exec())",
		);
	}
	return result;
}

/** Runs `fn` with every query and write limited to `tenant`. */
export function runInTenant<T>(tenant: LocalmanTenant, fn: () => T): T {
	return inScope({ tenantId: tenant.id, tenant }, fn);
}

/**
 * Runs `fn` on the data of tenant `tenantId` without its settings: for
 * ops commands (`--tenant`) and migrations, which never build URLs or
 * sign anyone in. `currentTenant()` throws inside.
 */
export function runInTenantData<T>(tenantId: string, fn: () => T): T {
	return inScope({ tenantId }, fn);
}

/**
 * Runs `fn` without a tenant filter: only for background jobs that list
 * work of every tenant, then handle each item with runInTenant. The source
 * scan test keeps the list of callers.
 */
export function acrossTenants<T>(fn: () => T): T {
	return inScope({ allTenants: true }, fn);
}

/** The tenant of the current request or job; undefined across tenants. */
export function findCurrentTenant(): LocalmanTenant | undefined {
	const scope = storage.getStore();
	return scope ? scope.tenant : testDefault;
}

/** True inside `acrossTenants`. */
export function isAcrossTenants(): boolean {
	return storage.getStore()?.allTenants === true;
}

/** The tenant of the current request or job; throws without one. */
export function currentTenant(): LocalmanTenant {
	const tenant = findCurrentTenant();
	if (!tenant) throw new MissingTenantError();
	return tenant;
}

/**
 * The tenant every query and write must be limited to. Throws without one:
 * a query that would otherwise run unfiltered must never reach another
 * tenant's data.
 */
export function currentTenantId(): string {
	const scope = storage.getStore();
	const tenantId = scope ? scope.tenantId : testDefault?.id;
	if (tenantId === undefined) throw new MissingTenantError();
	return tenantId;
}

/**
 * `key` qualified by the tenant in scope, for in-memory caches and limits
 * whose keys (secrets, owners) are only unique within a tenant.
 */
export function tenantKey(key: string): string {
	return `${currentTenantId()}\n${key}`;
}

/**
 * Tests only: the tenant used when a test calls models directly, outside
 * a request. Production never sets it, so a missing scope always throws.
 */
export function setTestDefaultTenant(tenant: LocalmanTenant | undefined): void {
	testDefault = tenant;
}
