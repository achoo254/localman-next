import type { JsonValue } from "@localman/shared";
import { dispatchRecordEvent } from "../mock-callbacks/dispatcher.js";
import { RecordModel } from "../resources/record-model.js";
import { createRecord, deleteRecord, updateRecord } from "./crud-handlers.js";
import {
	type MockTarget,
	ancestorsExist,
	collectionFilter,
	findRecord,
	queryFieldsOf,
	readRecords,
	viewOf,
} from "./mock-records.js";
import { applyListQuery, parseListQuery } from "./query-engine.js";
import { withRelations } from "./relation-fields.js";
import type { EndpointKind } from "./render-response.js";

/** What an endpoint produced; `null` data answers 404 "Not found". */
export interface EndpointResult {
	readonly status: number;
	readonly data: JsonValue | null;
	/**
	 * `$count` of a list: records left after filtering, before paging.
	 * Other endpoints count the route's collection when the template asks.
	 */
	readonly count: number | null;
	/**
	 * Bytes of records read to answer: a list scans its whole collection
	 * before filtering, so this can exceed the response.
	 */
	readonly readBytes: number;
}

/**
 * What an endpoint reads of a call: the list query (strings, as Express's
 * simple parser gives them) and the write body. A REST request and an MCP
 * tool call both supply it.
 */
export interface EndpointCall {
	readonly query: Readonly<Record<string, unknown>>;
	readonly body: unknown;
	/**
	 * The request came from a Localman delivery (`X-Localman-Hop`): its
	 * write fires no callback, so a callback into a mock cannot loop.
	 */
	readonly hop?: boolean;
}

/** Queues the resource's callbacks of a write unless it came from one. */
function fireCallbacks(
	target: MockTarget,
	event: "create" | "update" | "delete",
	record: JsonValue,
	call: EndpointCall,
): void {
	if (call.hop === true) return;
	dispatchRecordEvent(target.projectId, target.resource, event, record);
}

const notFound: EndpointResult = {
	status: 404,
	data: null,
	count: null,
	readBytes: 0,
};

async function collectionCount(
	target: MockTarget,
	wanted: boolean,
): Promise<number | null> {
	return wanted ? RecordModel.countDocuments(collectionFilter(target)) : null;
}

/**
 * Runs the endpoint of `kind` on `target`. `wantsCount` says whether the
 * response template uses `$count` (a list always knows it).
 */
export async function runEndpoint(
	kind: EndpointKind,
	target: MockTarget,
	recordId: string | null,
	call: EndpointCall,
	wantsCount: boolean,
): Promise<EndpointResult> {
	if (kind === "list") {
		// Validate the query before touching the database.
		const query = parseListQuery(call.query, queryFieldsOf(target));
		if (!(await ancestorsExist(target))) return notFound;
		const { views, bytes } = await readRecords(target);
		const { items, total } = applyListQuery(views, query);
		return {
			status: 200,
			data: await withRelations(target, items),
			count: total,
			readBytes: bytes,
		};
	}
	if (kind === "create") {
		const created = await createRecord(target, call.body);
		if (!created) return notFound;
		fireCallbacks(target, "create", created, call);
		return {
			status: 201,
			data: created,
			count: await collectionCount(target, wantsCount),
			readBytes: 0,
		};
	}
	if (recordId === null) return notFound;
	let data: JsonValue | null = null;
	if (kind === "one") {
		const record = (await ancestorsExist(target))
			? await findRecord(target, recordId)
			: null;
		if (record) {
			const [view] = await withRelations(target, [viewOf(target, record)]);
			data = view ?? null;
		}
	} else if (kind === "update") {
		data = await updateRecord(target, recordId, call.body);
	} else {
		data = await deleteRecord(target, recordId);
	}
	if (data === null) return notFound;
	if (kind !== "one") fireCallbacks(target, kind, data, call);
	return {
		status: 200,
		data,
		count: await collectionCount(target, wantsCount),
		readBytes: 0,
	};
}
