/** The changelog and recent activity of a collection, parsed. */
import {
	type ActivityItem,
	type AffectedNode,
	CHANGELOG_ACTIONS,
	type ChangelogChange,
	type ChangelogDiff,
	type ChangelogEntityKind,
	type ChangelogPage,
	type CollectionDetail,
} from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import { parseDetail } from "./collection-parsers";
import { collectionPath } from "./collections-api";

const KINDS: readonly ChangelogEntityKind[] = [
	"collection",
	"folder",
	"request",
	"example",
];

function changeOf(data: JsonRecord): ChangelogChange {
	const action = CHANGELOG_ACTIONS.find((item) => item === data.action);
	const entityKind = KINDS.find((item) => item === data.entityKind);
	const entity =
		data.entity === "collection" || data.entity === "node" ? data.entity : null;
	if (!action || !entityKind || !entity)
		throw new InvalidResponseError("change");
	return {
		id: expectString(data, "id"),
		at: expectString(data, "at"),
		action,
		entity,
		entityId: expectString(data, "entityId"),
		entityKind,
		entityName: expectString(data, "entityName"),
		fields: expectArray(data, "fields").filter(
			(f): f is string => typeof f === "string",
		),
		summary: expectString(data, "summary"),
		hidden: expectBoolean(data, "hidden"),
		restorable: expectBoolean(data, "restorable"),
	};
}

export const parseChange = (value: unknown) =>
	changeOf(expectRecord(value, "change"));

const changelogPath = (id: string) => `${collectionPath(id)}/changelog`;
const revisionPath = (id: string, revisionId: string) =>
	`${changelogPath(id)}/${encodeURIComponent(revisionId)}`;

/** One page of sessions, newest first; `before` comes from the previous page. */
export async function fetchChangelog(
	id: string,
	before: string | null,
): Promise<ChangelogPage> {
	const query = before ? `?before=${encodeURIComponent(before)}` : "";
	const data = expectRecord(
		await apiRequest(`${changelogPath(id)}${query}`),
		"changelog",
	);
	return {
		sessions: expectArray(data, "sessions").map((value) => {
			const session = expectRecord(value, "session");
			return {
				authorId: expectString(session, "authorId"),
				authorName: optionalString(session, "authorName"),
				from: expectString(session, "from"),
				to: expectString(session, "to"),
				changes: expectArray(session, "changes").map(parseChange),
			};
		}),
		nextBefore: optionalString(data, "nextBefore"),
	};
}

export async function fetchDiff(
	id: string,
	revisionId: string,
): Promise<ChangelogDiff> {
	const data = expectRecord(
		await apiRequest(`${revisionPath(id, revisionId)}/diff`),
		"diff",
	);
	return {
		revisionId: expectString(data, "revisionId"),
		hidden: expectBoolean(data, "hidden"),
		available: expectBoolean(data, "available"),
		before: data.before ?? null,
		after: data.after ?? null,
		...(Array.isArray(data.affected)
			? { affected: data.affected.map(parseAffected) }
			: {}),
	};
}

export async function setChangeHidden(
	id: string,
	revisionId: string,
	hidden: boolean,
): Promise<ChangelogChange> {
	return parseChange(
		await apiRequest(
			`${revisionPath(id, revisionId)}/${hidden ? "hide" : "show"}`,
			{
				method: "POST",
			},
		),
	);
}

/** The collection as it was right after the change (a new change records it). */
export async function restoreChange(
	id: string,
	revisionId: string,
): Promise<CollectionDetail> {
	const data = expectRecord(
		await apiRequest(`${revisionPath(id, revisionId)}/restore`, {
			method: "POST",
		}),
		"restore",
	);
	return parseDetail(data.collection);
}

const AFFECTED_CHANGES = ["added", "removed", "changed"] as const;

function parseAffected(value: unknown): AffectedNode {
	const data = expectRecord(value, "affected node");
	const change = AFFECTED_CHANGES.find((item) => item === data.change);
	if (!change) throw new InvalidResponseError("affected change");
	return {
		nodeId: expectString(data, "nodeId"),
		name: optionalString(data, "name"),
		change,
	};
}

export async function fetchActivity(
	id: string,
	limit: number,
): Promise<ActivityItem[]> {
	const data = expectRecord(
		await apiRequest(`${collectionPath(id)}/activity?limit=${limit}`),
		"activity",
	);
	return expectArray(data, "items").map((value) => {
		const item = expectRecord(value, "activity item");
		return {
			...changeOf(item),
			authorId: expectString(item, "authorId"),
			authorName: optionalString(item, "authorName"),
		};
	});
}
