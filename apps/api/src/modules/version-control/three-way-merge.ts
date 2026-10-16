/**
 * Three-way merge of keyed entities (collection nodes, the collection
 * root, environment variables) against their common ancestor. `source` is
 * the side the changes come from, `destination` the side being written, as
 * in "Keep Source" / "Keep Destination". Entities are matched by key, never
 * by position; fields are compared as JSON, objects listed in `nested` one
 * level deeper (a request's `draft.url` and `draft.headers` merge apart).
 */

export type MergeSide = "source" | "destination";

export interface MergeConflict {
	/** `<key>` for a delete against a change, `<key>:<path>` for a field. */
	readonly id: string;
	readonly key: string;
	/** Dotted field path; `""` when one side deleted the entity. */
	readonly path: string;
	readonly base: unknown;
	readonly source: unknown;
	readonly destination: unknown;
}

export interface MergeOutcome<T> {
	readonly result: Record<string, T>;
	/** Every conflict; resolved ones took the chosen side in `result`. */
	readonly conflicts: readonly MergeConflict[];
	/** Conflicts without a choice: `result` holds the destination there. */
	readonly unresolved: readonly string[];
}

export interface MergeOptions {
	/** Object fields merged field by field one level down. */
	readonly nested?: ReadonlySet<string>;
	/** Fields where a clash takes the source side without a conflict. */
	readonly sourceWins?: ReadonlySet<string>;
	/** Choices made for conflicts, by conflict id. */
	readonly resolutions?: Readonly<Record<string, MergeSide>>;
}

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON with sorted keys, so equal content compares equal. */
function canonical(value: unknown): string {
	return JSON.stringify(value, (_key, item: unknown) =>
		isFields(item)
			? Object.fromEntries(
					Object.keys(item)
						.sort()
						.map((key) => [key, item[key]]),
				)
			: item,
	);
}

export const sameContent = (a: unknown, b: unknown): boolean =>
	canonical(a) === canonical(b);

/**
 * An own property only: keys are user text (variable names), and
 * `constructor` or `__proto__` must not read the object's prototype.
 */
function own<T>(
	record: Readonly<Record<string, T>>,
	key: string,
): T | undefined {
	return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** A record without a prototype, safe for any key. */
const emptyRecord = <T>(): Record<string, T> => Object.create(null);

class Merger {
	readonly conflicts: MergeConflict[] = [];
	readonly unresolved: string[] = [];

	constructor(private readonly options: MergeOptions) {}

	/** The side chosen for a clash, recording it as a conflict. */
	private clash(
		key: string,
		path: string,
		values: { base: unknown; source: unknown; destination: unknown },
	): MergeSide {
		const id = path === "" ? key : `${key}:${path}`;
		this.conflicts.push({ id, key, path, ...values });
		const choice = this.options.resolutions?.[id];
		if (!choice) this.unresolved.push(id);
		return choice ?? "destination";
	}

	fields(
		key: string,
		base: Fields,
		source: Fields,
		destination: Fields,
		prefix = "",
	): Fields {
		const merged = emptyRecord<unknown>();
		const names = new Set([
			...Object.keys(base),
			...Object.keys(source),
			...Object.keys(destination),
		]);
		for (const name of names) {
			const path = prefix === "" ? name : `${prefix}.${name}`;
			const b = own(base, name);
			const s = own(source, name);
			const d = own(destination, name);
			let value: unknown;
			if (sameContent(s, d) || sameContent(s, b)) value = d;
			else if (sameContent(d, b)) value = s;
			else if (
				prefix === "" &&
				this.options.nested?.has(name) &&
				isFields(b) &&
				isFields(s) &&
				isFields(d)
			) {
				value = this.fields(key, b, s, d, path);
			} else if (this.options.sourceWins?.has(path)) value = s;
			else {
				const side = this.clash(key, path, {
					base: b,
					source: s,
					destination: d,
				});
				value = side === "source" ? s : d;
			}
			if (value !== undefined) merged[name] = value;
		}
		return merged;
	}

	entity<T extends Fields>(
		key: string,
		base: T | undefined,
		source: T | undefined,
		destination: T | undefined,
	): T | undefined {
		if (sameContent(source, destination) || sameContent(source, base)) {
			return destination;
		}
		if (sameContent(destination, base)) return source;
		if (source === undefined || destination === undefined) {
			// One side deleted it, the other changed it.
			const side = this.clash(key, "", { base, source, destination });
			return side === "source" ? source : destination;
		}
		// Both changed (or both added under the same key): field by field.
		return this.fields(key, base ?? {}, source, destination) as T;
	}
}

/**
 * Merges `source` into `destination` against `base`, entity by entity. An
 * entity missing from a side was deleted there (or never existed).
 */
export function mergeEntities<T extends Fields>(
	base: Readonly<Record<string, T>>,
	source: Readonly<Record<string, T>>,
	destination: Readonly<Record<string, T>>,
	options: MergeOptions = {},
): MergeOutcome<T> {
	const merger = new Merger(options);
	const result = emptyRecord<T>();
	const keys = new Set([
		...Object.keys(base),
		...Object.keys(source),
		...Object.keys(destination),
	]);
	for (const key of keys) {
		const value = merger.entity(
			key,
			own(base, key),
			own(source, key),
			own(destination, key),
		);
		if (value !== undefined) result[key] = value;
	}
	return {
		result,
		conflicts: merger.conflicts,
		unresolved: merger.unresolved,
	};
}
