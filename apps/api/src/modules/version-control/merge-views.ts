import type {
	CollectionNode,
	MergeChange,
	MergeConflictView,
	MergePreview,
} from "@localman/shared/api-client";
import {
	flaggedSecretKeys,
	withholdCredentials,
	withholdVariables,
} from "../collections/collection-secret-mask.js";
import type { CollectionState } from "../collections/revision-patch.js";
import { ROOT_KEY } from "./collection-merge.js";
import { type MergeConflict, sameContent } from "./three-way-merge.js";

/** What the destination becomes: added, removed and changed items. */
function changesOf(
	destination: CollectionState,
	merged: CollectionState,
): MergeChange[] {
	const changes: MergeChange[] = [];
	if (!sameContent(destination.root, merged.root)) {
		changes.push({
			key: ROOT_KEY,
			kind: "changed",
			entityKind: "collection",
			name: merged.root.name,
		});
	}
	const ids = new Set([
		...Object.keys(destination.nodes),
		...Object.keys(merged.nodes),
	]);
	for (const id of ids) {
		const before = destination.nodes[id];
		const after = merged.nodes[id];
		if (sameContent(before, after)) continue;
		const node = (after ?? before) as CollectionNode;
		const kind = !before ? "added" : !after ? "removed" : "changed";
		changes.push({ key: id, kind, entityKind: node.kind, name: node.name });
	}
	return changes;
}

function conflictView(
	conflict: MergeConflict,
	states: readonly CollectionState[],
): MergeConflictView {
	const { id, key, path, base, source, destination } = conflict;
	if (key === ROOT_KEY) {
		const root = states[0]?.root;
		return {
			id,
			entityKind: "collection",
			name: root?.name ?? "",
			path,
			base,
			source,
			destination,
		};
	}
	const node = states
		.map((state) => state.nodes[key])
		.find((item) => item !== undefined);
	return {
		id,
		entityKind: node?.kind ?? "request",
		name: node?.name ?? "",
		path,
		base,
		source,
		destination,
	};
}

/** The preview of a pull or merge: changes on the destination, conflicts. */
export function mergePreview(
	states: {
		base: CollectionState;
		source: CollectionState;
		destination: CollectionState;
		merged: CollectionState;
	},
	conflicts: readonly MergeConflict[],
): MergePreview {
	const all = [states.source, states.destination, states.base];
	return {
		changes: changesOf(states.destination, states.merged),
		conflicts: conflicts.map((conflict) => conflictView(conflict, all)),
	};
}

/** Tool descriptions of the previews `withholdPreviewSecrets` masks. */
export const AGENT_PREVIEW =
	'For an agent (a token, not the web app), conflicts carry no secret collection variable value and no credential typed into an auth (bearer token, basic password, API key value; a `{{variable}}` stays): both read as `""`.';

/** A conflict on the collection's variables: its sides are whole lists. */
const onVariables = (conflict: MergeConflictView): boolean =>
	conflict.entityKind === "collection" && conflict.path === "variables";

/**
 * The preview as an agent (a token, not a browser session) reads it: in a
 * conflict on the collection's variables, a variable secret on any side
 * has its value blanked on every side; in every conflict, a credential
 * typed into an auth is blanked. Environment previews never carry secret
 * values, so this changes nothing there.
 */
export function withholdPreviewSecrets(preview: MergePreview): MergePreview {
	const sides = preview.conflicts
		.filter(onVariables)
		.flatMap((conflict) => [
			conflict.base,
			conflict.source,
			conflict.destination,
		]);
	const secrets = flaggedSecretKeys(...sides);
	const isSecret = (key: string) => secrets.has(key);
	return {
		...preview,
		conflicts: preview.conflicts.map((conflict) => {
			const side = (value: unknown): unknown =>
				withholdCredentials(
					onVariables(conflict) ? withholdVariables(value, isSecret) : value,
				);
			return {
				...conflict,
				base: side(conflict.base),
				source: side(conflict.source),
				destination: side(conflict.destination),
			};
		}),
	};
}
