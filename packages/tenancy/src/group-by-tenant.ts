import type { TenantLike } from "./tenant-context.js";

/** Something counted or buffered in a request, written later in its tenant. */
export interface TenantOwned {
	readonly tenant: TenantLike;
}

/** `entries` grouped by tenant, each group in its original order. */
export function groupByTenant<E extends TenantOwned>(
	entries: Iterable<E>,
): { readonly tenant: E["tenant"]; readonly entries: E[] }[] {
	const groups = new Map<string, { tenant: E["tenant"]; entries: E[] }>();
	for (const entry of entries) {
		const group = groups.get(entry.tenant.id);
		if (group) group.entries.push(entry);
		else
			groups.set(entry.tenant.id, { tenant: entry.tenant, entries: [entry] });
	}
	return [...groups.values()];
}
