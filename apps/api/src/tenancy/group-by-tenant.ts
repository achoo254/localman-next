import type { LocalmanTenant } from "./tenant-context.js";

/** Something counted or buffered in a request, written later in its tenant. */
export interface TenantOwned {
	readonly tenant: LocalmanTenant;
}

/** `entries` grouped by tenant, each group in its original order. */
export function groupByTenant<T extends TenantOwned>(
	entries: Iterable<T>,
): { readonly tenant: LocalmanTenant; readonly entries: T[] }[] {
	const groups = new Map<string, { tenant: LocalmanTenant; entries: T[] }>();
	for (const entry of entries) {
		const group = groups.get(entry.tenant.id);
		if (group) group.entries.push(entry);
		else
			groups.set(entry.tenant.id, { tenant: entry.tenant, entries: [entry] });
	}
	return [...groups.values()];
}
