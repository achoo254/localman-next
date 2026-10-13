import type {
	IndexDefinition,
	MongooseQueryMiddleware,
	Schema,
} from "mongoose";
import { currentTenantId, isAcrossTenants } from "./tenant-context.js";
import { MissingTenantError } from "./tenant-errors.js";
import { prefixIndexes } from "./tenant-indexes.js";
import {
	isObject,
	refuseTenantChange,
	scopeBulkOperations,
	stampDocument,
} from "./tenant-writes.js";

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
const UPDATES: MongooseQueryMiddleware[] = [
	"findOneAndUpdate",
	"updateMany",
	"updateOne",
];

/** Marks schemas the plugin was applied to (checked by a test). */
export const TENANT_SCOPED = Symbol.for("localman.tenantScoped");

export interface TenantScopeOptions {
	/**
	 * Index keys kept without the `tenantId` prefix, for queries that run
	 * across tenants (`acrossTenants`) and would otherwise scan.
	 */
	readonly acrossTenants?: readonly IndexDefinition[];
}

/**
 * Makes a model tenant-owned: a `tenantId` field set on every insert, a
 * `tenantId` filter on every query, update, delete, aggregation and bulk
 * write (from the tenant in scope; none in scope throws), no write that
 * moves a document to another tenant, and every index prefixed with it.
 * Raw driver calls (`Model.collection`) bypass it and must add
 * `tenantId` themselves.
 */
export function tenantScopePlugin(
	schema: Schema,
	options: TenantScopeOptions = {},
): void {
	schema.add({ tenantId: { type: String, required: true } });
	prefixIndexes(schema, options.acrossTenants);
	Reflect.set(schema, TENANT_SCOPED, true);
	schema.pre(FILTERED_QUERIES, function scopeQuery() {
		if (isAcrossTenants()) return;
		this.where({ tenantId: currentTenantId() });
	});
	schema.pre(UPDATES, function keepTenant() {
		refuseTenantChange(this.getUpdate(), currentTenantId);
	});
	// Its count comes from collection metadata: no filter can apply.
	schema.pre("estimatedDocumentCount", function wholeCollection() {
		if (!isAcrossTenants()) throw new MissingTenantError();
	});
	// `save()` of a loaded document writes by `_id` alone: refuse one that
	// belongs to another tenant than the one in scope.
	schema.pre("validate", function stampSaved() {
		stampDocument(this, currentTenantId());
	});
	schema.pre("insertMany", function stampMany(docs: unknown) {
		const tenantId = currentTenantId();
		for (const doc of Array.isArray(docs) ? docs : [docs]) {
			if (isObject(doc)) stampDocument(doc, tenantId);
		}
	});
	// An upserted replacement keeps only `_id` from the filter.
	schema.pre(["replaceOne", "findOneAndReplace"], function stampReplacement() {
		const replacement = this.getUpdate();
		if (replacement && !Array.isArray(replacement)) {
			const copy = { ...replacement };
			stampDocument(copy, currentTenantId());
			this.setUpdate(copy);
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
