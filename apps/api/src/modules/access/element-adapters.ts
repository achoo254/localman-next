import type { ShareableElementType } from "@localman/shared/access";
import type { ClientSession, Types } from "mongoose";

/** What the access layer needs to know about one element. */
export interface ElementRecord {
	readonly type: ShareableElementType;
	readonly id: string;
	readonly name: string;
	readonly workspaceId: Types.ObjectId;
}

/**
 * How the access layer reaches the elements of one type. Collections
 * (phase 12) and environments (phase 13) register theirs; until then only
 * tests do.
 */
export interface ElementAdapter {
	/** The element, or `null` when there is none with this id. */
	load(id: string): Promise<ElementRecord | null>;
	/** Moves the element to another workspace. */
	moveTo(
		id: string,
		workspaceId: Types.ObjectId,
		session?: ClientSession,
	): Promise<void>;
}

const adapters = new Map<ShareableElementType, ElementAdapter>();

export function registerElementAdapter(
	type: ShareableElementType,
	adapter: ElementAdapter,
): void {
	adapters.set(type, adapter);
}

/** For tests: forgets every registered adapter. */
export function resetElementAdapters(): void {
	adapters.clear();
}

/** The adapter of `type`, `null` while that element type does not exist yet. */
export function elementAdapter(
	type: ShareableElementType,
): ElementAdapter | null {
	return adapters.get(type) ?? null;
}
