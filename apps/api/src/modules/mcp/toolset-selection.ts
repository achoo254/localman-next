import {
	DEFAULT_TOOLSETS,
	OperationError,
	TOOLSETS,
	type Toolset,
} from "@localman/operations";

/** Longest `?toolsets=` value accepted (every toolset name fits easily). */
const MAX_TOOLSETS_PARAM_LENGTH = 512;

function isToolset(name: string): name is Toolset {
	return TOOLSETS.some((toolset) => toolset === name);
}

/**
 * Toolsets chosen through `?toolsets=a,b`. Missing or blank means the
 * defaults (`mock` and `client`); an unknown name is a 400 so a typo does
 * not silently hide tools.
 */
export function parseToolsetsParam(raw: unknown): Toolset[] {
	if (raw === undefined || raw === null) return [...DEFAULT_TOOLSETS];
	if (typeof raw !== "string" || raw.length > MAX_TOOLSETS_PARAM_LENGTH) {
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			'"toolsets" must be a comma-separated list of toolset names',
		);
	}
	const names = raw
		.split(",")
		.map((name) => name.trim())
		.filter((name) => name !== "");
	if (names.length === 0) return [...DEFAULT_TOOLSETS];
	const unknown = names.filter((name) => !isToolset(name));
	if (unknown.length > 0) {
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			`Unknown toolset: ${unknown.join(", ")}. Known toolsets: ${TOOLSETS.join(", ")}`,
		);
	}
	return [...new Set(names.filter(isToolset))];
}

/**
 * Toolsets a principal turned on with `enable_toolset`. Over Streamable
 * HTTP every request builds a new server, so the choice must outlive the
 * server instance; it is keyed by principal, never by a hidden session.
 */
export interface ToolsetSelectionStore {
	get(principalKey: string): readonly Toolset[];
	add(principalKey: string, toolset: Toolset): void;
}

export interface MemoryToolsetSelectionOptions {
	/** Forget a principal's choice after this long without a change. */
	readonly ttlMs?: number;
	/** Most principals remembered; the oldest choice is dropped first. */
	readonly maxEntries?: number;
	readonly now?: () => number;
}

interface SelectionEntry {
	readonly toolsets: readonly Toolset[];
	readonly expiresAt: number;
}

/**
 * Per-process store. Losing an entry only means the agent calls
 * `enable_toolset` again, so a bounded in-memory map is enough.
 */
export function createMemoryToolsetSelectionStore(
	options: MemoryToolsetSelectionOptions = {},
): ToolsetSelectionStore {
	const ttlMs = options.ttlMs ?? 12 * 60 * 60 * 1000;
	const maxEntries = options.maxEntries ?? 10_000;
	const now = options.now ?? Date.now;
	const entries = new Map<string, SelectionEntry>();

	function current(key: string): SelectionEntry | undefined {
		const entry = entries.get(key);
		if (entry && entry.expiresAt <= now()) {
			entries.delete(key);
			return undefined;
		}
		return entry;
	}

	return {
		get(key) {
			return current(key)?.toolsets ?? [];
		},
		add(key, toolset) {
			const known = current(key)?.toolsets ?? [];
			const toolsets = known.includes(toolset) ? known : [...known, toolset];
			// Re-insert so Map order stays oldest-change first.
			entries.delete(key);
			entries.set(key, { toolsets, expiresAt: now() + ttlMs });
			while (entries.size > maxEntries) {
				const oldest = entries.keys().next();
				if (oldest.done) break;
				entries.delete(oldest.value);
			}
		},
	};
}
