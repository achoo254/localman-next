import { CrossTenantWriteError } from "./tenant-errors.js";

export function isObject(value: unknown): value is object {
	return typeof value === "object" && value !== null;
}

/** `$set` and `$setOnInsert` may hold `tenantId` when it is unchanged. */
const KEEPING = new Set(["$set", "$setOnInsert"]);

/**
 * Throws when an update would move documents to another tenant or drop
 * their `tenantId`: a value other than the tenant in scope, `$unset`,
 * `$rename` and the like, or an aggregation pipeline naming it.
 * `tenantId()` is only asked when the update names the field.
 */
export function refuseTenantChange(
	update: unknown,
	tenantId: () => string,
): void {
	if (Array.isArray(update)) {
		if (JSON.stringify(update).includes('"tenantId"')) {
			throw new CrossTenantWriteError();
		}
		return;
	}
	if (!isObject(update)) return;
	for (const [key, value] of Object.entries(update)) {
		if (key === "tenantId") {
			if (value !== tenantId()) throw new CrossTenantWriteError();
			continue;
		}
		if (!key.startsWith("$") || !isObject(value)) continue;
		const named =
			"tenantId" in value || Object.values(value).includes("tenantId");
		if (!named) continue;
		if (!KEEPING.has(key) || Reflect.get(value, "tenantId") !== tenantId()) {
			throw new CrossTenantWriteError();
		}
	}
}

/**
 * Scopes each operation of a bulkWrite: the operation's filter is
 * replaced by a copy with `tenantId`, inserted and replacing documents
 * are stamped in place, updates may not change `tenantId`.
 */
export function scopeBulkOperations(
	operations: unknown,
	tenantId: string,
): void {
	if (!Array.isArray(operations)) return;
	for (const operation of operations) {
		if (!isObject(operation)) continue;
		for (const body of Object.values(operation)) {
			if (!isObject(body)) continue;
			const filter: unknown = Reflect.get(body, "filter");
			if (isObject(filter))
				Reflect.set(body, "filter", { ...filter, tenantId });
			refuseTenantChange(Reflect.get(body, "update"), () => tenantId);
			for (const key of ["document", "replacement"]) {
				const document: unknown = Reflect.get(body, key);
				if (isObject(document)) stampDocument(document, tenantId);
			}
		}
	}
}

/** Sets a new document's `tenantId`; one of another tenant is refused. */
export function stampDocument(document: object, tenantId: string): void {
	const stored: unknown = Reflect.get(document, "tenantId");
	if (stored === undefined || stored === null) {
		Reflect.set(document, "tenantId", tenantId);
	} else if (stored !== tenantId) {
		throw new CrossTenantWriteError();
	}
}
