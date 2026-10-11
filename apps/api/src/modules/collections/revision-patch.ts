import type {
	ChangelogAction,
	ChangelogEntity,
	ChangelogEntityKind,
	CollectionNode,
	CollectionRootFields,
} from "@localman/shared/api-client";
import jsonPatch, { type Operation } from "fast-json-patch";

/**
 * The state document revisions patch: the root's content and every node
 * by id. A slice holds only what one change touched; `nodes` is always
 * present so patches address `/nodes/<id>`, never the whole map.
 */
export interface StateSlice {
	root?: CollectionRootFields;
	nodes: Record<string, CollectionNode>;
}

export interface CollectionState {
	root: CollectionRootFields;
	nodes: Record<string, CollectionNode>;
}

export interface RevisionDraft {
	readonly entity: ChangelogEntity;
	readonly entityId: string;
	readonly entityKind: ChangelogEntityKind;
	readonly entityName: string;
	readonly action: ChangelogAction;
	readonly before: StateSlice;
	readonly after: StateSlice;
}

export interface BuiltRevision {
	readonly entity: ChangelogEntity;
	readonly entityId: string;
	readonly entityKind: ChangelogEntityKind;
	readonly entityName: string;
	readonly action: ChangelogAction;
	readonly fields: string[];
	readonly forward: Operation[];
	readonly inverse: Operation[];
	readonly touched: string[];
	readonly partial: boolean;
	readonly bytes: number;
}

/**
 * Patches above this (forward and inverse together, as JSON) are not
 * kept: the revision stays in the changelog without a diff, and nothing
 * older than it can be restored. A revision is one MongoDB document.
 */
export const REVISION_PATCH_MAX = 4 * 1024 * 1024;

/** `root`, or the node id, a patch path is about. */
export function entityOfPath(path: string): string {
	const [, top, id] = path.split("/");
	return top === "nodes" && id ? id : (top ?? "");
}

/** Top-level field of the entity a path changes; `null` for a whole node. */
function fieldOfPath(path: string): string | null {
	const parts = path.split("/");
	const field = parts[1] === "root" ? parts[2] : parts[3];
	return field ?? null;
}

function unique(values: Iterable<string>): string[] {
	return [...new Set(values)];
}

/** Forward and inverse patches of a change, with what they touch. */
export function buildRevision(draft: RevisionDraft): BuiltRevision {
	const forward = jsonPatch.compare(draft.before, draft.after);
	const inverse = jsonPatch.compare(draft.after, draft.before);
	const touched = unique(forward.map((op) => entityOfPath(op.path)));
	const fields = unique(
		forward.flatMap((op) => {
			const field = fieldOfPath(op.path);
			return field ? [field] : [];
		}),
	);
	const { before: _before, after: _after, ...meta } = draft;
	const bytes = Buffer.byteLength(JSON.stringify([forward, inverse]), "utf8");
	if (bytes > REVISION_PATCH_MAX) {
		return {
			...meta,
			fields,
			forward: [],
			inverse: [],
			touched,
			partial: true,
			bytes: 0,
		};
	}
	return { ...meta, fields, forward, inverse, touched, partial: false, bytes };
}

/** A change to record: still to diff, or already built (to check it first). */
export type RevisionInput = RevisionDraft | BuiltRevision;

export function builtRevision(input: RevisionInput): BuiltRevision {
	return "forward" in input ? input : buildRevision(input);
}

/**
 * Whether recording these changes would keep one without patches: such a
 * change cannot be undone and blocks restoring anything older.
 */
export function isIrreversible(revisions: readonly BuiltRevision[]): boolean {
	return revisions.some((revision) => revision.partial);
}

/** `doc` with `ops` applied (a copy; throws when a patch does not fit). */
export function applyOps<T>(doc: T, ops: readonly Operation[]): T {
	return applyInPlace(jsonPatch.deepClone(doc), ops);
}

/** Applies `ops` to `doc` itself, for a document built for the purpose. */
export function applyInPlace<T>(doc: T, ops: readonly Operation[]): T {
	return jsonPatch.applyPatch(doc, [...ops], true, true).newDocument;
}

/** The operations of `ops` about `entity` (`root` or a node id). */
export function opsOf(ops: readonly Operation[], entity: string): Operation[] {
	return ops.filter((op) => entityOfPath(op.path) === entity);
}
