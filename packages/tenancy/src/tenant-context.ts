import { AsyncLocalStorage } from "node:async_hooks";
import mongoose from "mongoose";
import { MissingTenantError } from "./tenant-errors.js";

/** What every app's tenant has: the IdP's tenant id. */
export interface TenantLike {
	/** `primary` for the deployment's own domain, `ten_…` otherwise. */
	readonly id: string;
}

interface Scope<T> {
	/** Whose data queries and writes are limited to. */
	readonly tenantId?: string;
	/** The tenant's settings; absent in a data-only scope (ops commands). */
	readonly tenant?: T;
	/** A job listing work across tenants (the scope plugin skips the filter). */
	readonly allTenants?: true;
}

/** The scope functions of one app (one per process). */
export interface TenantContext<T extends TenantLike> {
	/** Runs `fn` with every query and write limited to `tenant`. */
	runInTenant<R>(tenant: T, fn: () => R): R;
	/**
	 * Runs `fn` on the data of tenant `tenantId` without its settings: for
	 * ops commands (`--tenant`) and migrations. `currentTenant()` throws.
	 */
	runInTenantData<R>(tenantId: string, fn: () => R): R;
	/**
	 * Runs `fn` without a tenant filter: only for background work listing
	 * jobs of every tenant, each then handled with `runInTenant`.
	 */
	acrossTenants<R>(fn: () => R): R;
	/** The tenant of the current request or job; undefined across tenants. */
	findCurrentTenant(): T | undefined;
	/** The tenant of the current request or job; throws without one. */
	currentTenant(): T;
	/**
	 * The tenant every query and write is limited to; throws without one,
	 * so a query never runs unfiltered against other tenants' data.
	 */
	currentTenantId(): string;
	/** True inside `acrossTenants`. */
	isAcrossTenants(): boolean;
	/** `key` qualified by the tenant in scope (in-memory caches, limits). */
	tenantKey(key: string): string;
	/**
	 * Tests only: the tenant of code running outside any scope. Production
	 * never sets it, so a missing scope always throws.
	 */
	setTestDefaultTenant(tenant: T | undefined): void;
}

/**
 * The AsyncLocalStorage scope of one app's tenants. A function returning
 * an unawaited mongoose query or aggregation is refused: it would run
 * when awaited, in the caller's scope.
 */
export function createTenantContext<T extends TenantLike>(): TenantContext<T> {
	const storage = new AsyncLocalStorage<Scope<T>>();
	let testDefault: T | undefined;
	const inScope = <R>(scope: Scope<T>, fn: () => R): R => {
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
	};
	const findCurrentTenant = (): T | undefined => {
		const scope = storage.getStore();
		return scope ? scope.tenant : testDefault;
	};
	const currentTenantId = (): string => {
		const scope = storage.getStore();
		const tenantId = scope ? scope.tenantId : testDefault?.id;
		if (tenantId === undefined) throw new MissingTenantError();
		return tenantId;
	};
	return {
		runInTenant: (tenant, fn) => inScope({ tenantId: tenant.id, tenant }, fn),
		runInTenantData: (tenantId, fn) => inScope({ tenantId }, fn),
		acrossTenants: (fn) => inScope({ allTenants: true }, fn),
		findCurrentTenant,
		currentTenant: () => {
			const tenant = findCurrentTenant();
			if (!tenant) throw new MissingTenantError();
			return tenant;
		},
		currentTenantId,
		isAcrossTenants: () => storage.getStore()?.allTenants === true,
		tenantKey: (key) => `${currentTenantId()}\n${key}`,
		setTestDefaultTenant: (tenant) => {
			testDefault = tenant;
		},
	};
}
