import type { IndexDefinition, IndexOptions, Schema } from "mongoose";

const sameKeys = (a: IndexDefinition, b: IndexDefinition): boolean =>
	JSON.stringify(a) === JSON.stringify(b);

/**
 * Every index of the schema (child schemas' included) now leads with
 * `tenantId`: unique values are unique per tenant, lookups stay indexed.
 * Kept as declared: TTL indexes (MongoDB wants them single-field) and
 * `acrossTenants` ones, for the few queries that list work of every
 * tenant (the outbound queue). A named index gets a new name, as MongoDB
 * refuses a name already used with other keys.
 */
export function prefixIndexes(
	schema: Schema,
	acrossTenants: readonly IndexDefinition[] = [],
): void {
	const all: [IndexDefinition, IndexOptions][] = schema.indexes();
	// Mongoose keeps `index: true` paths on the schema types too.
	const strip = (target: Schema): void => {
		for (const path of Object.keys(target.paths)) {
			const type = target.path(path) as unknown as { _index: unknown };
			if (type._index) type._index = null;
		}
		target.clearIndexes();
		for (const child of target.childSchemas) strip(child.schema);
	};
	strip(schema);
	for (const [fields, options] of all) {
		const ttl = "expireAfterSeconds" in options || "expires" in options;
		if (ttl || acrossTenants.some((keys) => sameKeys(keys, fields))) {
			schema.index(fields, options);
			continue;
		}
		const renamed = options.name ? { name: `tenant_${options.name}` } : {};
		schema.index({ tenantId: 1, ...fields }, { ...options, ...renamed });
	}
}
