/** Forks, pull and merge of a collection or an environment, parsed. */
import type {
	ConflictSide,
	ForkKind,
	ForkListItem,
	ForkStatus,
	MergeChange,
	MergeConflictView,
	MergeOption,
	MergePreview,
} from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import { collectionPath } from "../collections/collections-api";
import { environmentPath } from "../environments/environments-api";

/** A collection or an environment, by id. */
export interface ForkTarget {
	kind: ForkKind;
	id: string;
}

const pathOf = ({ kind, id }: ForkTarget): string =>
	kind === "collection" ? collectionPath(id) : environmentPath(id);

function statusOf(value: unknown): ForkStatus {
	const data = expectRecord(value, "fork status");
	const fork = data.fork === null ? null : expectRecord(data.fork, "fork");
	const source = fork ? expectRecord(fork.source, "fork source") : null;
	return {
		forkCount: expectNumber(data, "forkCount"),
		fork:
			fork && source
				? {
						label: expectString(fork, "label"),
						createdBy: expectString(fork, "createdBy"),
						createdByName: optionalString(fork, "createdByName"),
						createdAt: expectString(fork, "createdAt"),
						source: {
							id: expectString(source, "id"),
							name: optionalString(source, "name"),
							available: expectBoolean(source, "available"),
							canMerge: expectBoolean(source, "canMerge"),
						},
					}
				: null,
	};
}

export async function fetchForkStatus(target: ForkTarget): Promise<ForkStatus> {
	return statusOf(await apiRequest(`${pathOf(target)}/fork-status`));
}

export async function fetchForks(target: ForkTarget): Promise<ForkListItem[]> {
	const data = expectRecord(
		await apiRequest(`${pathOf(target)}/forks`),
		"forks",
	);
	return expectArray(data, "items").map((value) => {
		const item = expectRecord(value, "fork");
		return {
			forkId: expectString(item, "forkId"),
			label: expectString(item, "label"),
			createdByName: optionalString(item, "createdByName"),
			createdAt: expectString(item, "createdAt"),
			canOpen: expectBoolean(item, "canOpen"),
		};
	});
}

/** Creates the fork; returns its id. */
export async function createFork(
	target: ForkTarget,
	input: { label: string; workspaceId: string; environmentIds?: string[] },
): Promise<string> {
	const data = expectRecord(
		await apiRequest(`${pathOf(target)}/forks`, {
			method: "POST",
			body: input,
		}),
		"fork",
	);
	return expectString(data, "id");
}

export async function relabelFork(
	target: ForkTarget,
	label: string,
): Promise<void> {
	await apiRequest(`${pathOf(target)}/fork`, {
		method: "PATCH",
		body: { label },
	});
}

const KINDS: readonly MergeChange["entityKind"][] = [
	"collection",
	"folder",
	"request",
	"example",
	"environment",
	"variable",
];

function entityKindOf(data: JsonRecord): MergeChange["entityKind"] {
	const kind = KINDS.find((item) => item === data.entityKind);
	if (!kind) throw new InvalidResponseError("entity kind");
	return kind;
}

function changeOf(value: unknown): MergeChange {
	const data = expectRecord(value, "change");
	const kind =
		data.kind === "added" || data.kind === "removed" || data.kind === "changed"
			? data.kind
			: null;
	if (!kind) throw new InvalidResponseError("change kind");
	return {
		key: expectString(data, "key"),
		kind,
		entityKind: entityKindOf(data),
		name: expectString(data, "name"),
	};
}

function conflictOf(value: unknown): MergeConflictView {
	const data = expectRecord(value, "conflict");
	return {
		id: expectString(data, "id"),
		entityKind: entityKindOf(data),
		name: expectString(data, "name"),
		path: expectString(data, "path"),
		base: data.base,
		source: data.source,
		destination: data.destination,
	};
}

export function parseMergePreview(value: unknown): MergePreview {
	const data = expectRecord(value, "merge preview");
	return {
		changes: expectArray(data, "changes").map(changeOf),
		conflicts: expectArray(data, "conflicts").map(conflictOf),
	};
}

/** What a pull (into the fork) or merge (into its source) would do. */
export async function fetchSyncPreview(
	fork: ForkTarget,
	direction: "pull" | "merge",
): Promise<MergePreview> {
	return parseMergePreview(await apiRequest(`${pathOf(fork)}/${direction}`));
}

export async function applySync(
	fork: ForkTarget,
	direction: "pull" | "merge",
	resolutions: Record<string, ConflictSide>,
	option: MergeOption = "merge",
): Promise<{ followUpFailed: boolean }> {
	const data = await apiRequest(`${pathOf(fork)}/${direction}`, {
		method: "POST",
		body: direction === "merge" ? { option, resolutions } : { resolutions },
	});
	// After a merge, updating or deleting the fork can fail on its own.
	return {
		followUpFailed:
			typeof data === "object" &&
			data !== null &&
			"followUp" in data &&
			data.followUp === "failed",
	};
}
