import type {
	IndexDefinition,
	IndexOptions,
	MongooseQueryMiddleware,
	Schema,
} from "mongoose";
import {
	MissingTenantError,
	currentTenantId,
	isAcrossTenants,
} from "./tenant-context.js";

/** Query middleware that reads a filter; each gets `tenantId` added. */
const FILTERED_QUERIES: MongooseQueryMiddleware[] = [
	"countDocuments",
	"deleteMany",
	"deleteOne",
	"distinct",
	"find",
	"findOne",
	"findOneAndDelete",
	"findOneAndReplace",
	"findOneAndUpdate",
	"replaceOne",
	"updateMany",
	"updateOne",
];

export class CrossTenantWriteError extends Error {
	constructor() {
		super("A document of another tenant cannot be saved here");
		this.name = "CrossTenantWriteError";
	}
}

/** Marks schemas the plugin was applied to (checked by a test). */
export const TENANT_SCOPED = Symbol.for("localman.tenantScoped");

/**
 * Every index of the schema (child schemas' included) now leads with
 * `tenantId`: unique values are unique per tenant, lookups stay indexed.
 * TTL indexes stay single-field (MongoDB requires it).
 */
function prefixIndexes(schema: Schema): void {
	const all: [IndexDefinition, IndexOptions][] = schema.indexes();
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
		schema.index(ttl ? fields : { tenantId: 1, ...fields }, options);
	}
}

function isObject(value: unknown): value is object {
	return typeof value === "object" && value !== null;
}

/**
 * Adds `tenantId` to each operation of a bulkWrite: to the filter (a copy,
 * callers may reuse theirs) and to inserted or replacing documents.
 */
function scopeBulkOperations(operations: unknown, tenantId: string): void {
	if (!Array.isArray(operations)) return;
	for (const operation of operations) {
		if (!isObject(operation)) continue;
		for (const body of Object.values(operation)) {
			if (!isObject(body)) continue;
			const filter: unknown = Reflect.get(body, "filter");
			if (isObject(filter))
				Reflect.set(body, "filter", { ...filter, tenantId });
			for (const key of ["document", "replacement"]) {
				const document: unknown = Reflect.get(body, key);
				if (isObject(document)) Reflect.set(document, "tenantId", tenantId);
			}
		}
	}
}

/**
 * Makes a model tenant-owned: a `tenantId` field set on every insert, a
 * `tenantId` filter on every query, update, delete, aggregation and bulk
 * write (from
 * the tenant in scope; none in scope throws), and every index prefixed
 * with it. Raw driver calls (`Model.collection`) bypass it and must add
 * `tenantId` themselves.
 */
export function tenantScopePlugin(schema: Schema): void {
	schema.add({ tenantId: { type: String, required: true } });
	prefixIndexes(schema);
	Reflect.set(schema, TENANT_SCOPED, true);
	schema.pre(FILTERED_QUERIES, function scopeQuery() {
		if (isAcrossTenants()) return;
		this.where({ tenantId: currentTenantId() });
	});
	// `save()` of a loaded document writes by `_id` alone: refuse one that
	// belongs to another tenant than the one in scope.
	schema.pre("validate", function stampDocument() {
		const tenantId = currentTenantId();
		const stored: unknown = this.get("tenantId");
		if (stored === undefined || stored === null) this.set("tenantId", tenantId);
		else if (stored !== tenantId) throw new CrossTenantWriteError();
	});
	schema.pre("insertMany", function stampMany(docs: unknown) {
		const tenantId = currentTenantId();
		for (const doc of Array.isArray(docs) ? docs : [docs]) {
			if (isObject(doc) && !Reflect.get(doc, "tenantId")) {
				Reflect.set(doc, "tenantId", tenantId);
			}
		}
	});
	// An upserted replacement keeps only `_id` from the filter.
	schema.pre(["replaceOne", "findOneAndReplace"], function stampReplacement() {
		const replacement = this.getUpdate();
		if (replacement && !Array.isArray(replacement)) {
			this.setUpdate({ ...replacement, tenantId: currentTenantId() });
		}
	});
	schema.pre("aggregate", function scopeAggregate() {
		if (isAcrossTenants()) return;
		this.pipeline().unshift({ $match: { tenantId: currentTenantId() } });
	});
	schema.pre("bulkWrite", function scopeBulk(operations: unknown) {
		scopeBulkOperations(operations, currentTenantId());
	});
}

/** The `tenantId` of a document read from a tenant-owned collection. */
export function storedTenantId(doc: object): string {
	const tenantId: unknown = Reflect.get(doc, "tenantId");
	if (typeof tenantId !== "string") throw new MissingTenantError();
	return tenantId;
}
