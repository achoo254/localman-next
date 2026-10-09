/**
 * Names split for the Faker field matcher (`faker-field-matcher.ts`):
 * tokens, and the runs of tokens a rule is tried on. Both are bounded so
 * matching a name costs the same whatever its shape.
 */
import { FIELD_NAME_MAX } from "./resource-constants.js";

/** Name tokens read: the first and last half when a name has more. */
const MAX_NAME_TOKENS = 8;
/** Tokens a rule may match at once (`so_dien_thoai` is three). */
const MAX_RUN_TOKENS = 4;

/** `createdAt`, `created_at`, `avatarURL2` → `created at`, `avatar url 2`. */
export function fieldNameTokens(name: string): string[] {
	return name
		.slice(0, FIELD_NAME_MAX)
		.replace(/([a-z\d])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.replace(/([A-Za-z])(\d)/g, "$1 $2")
		.toLowerCase()
		.split(/[^a-z\d]+/)
		.filter((token) => token.length > 0);
}

/** Joined tokens `from`…`to` of a name, and where they sit in it. */
export interface NameRun {
	readonly text: string;
	readonly atStart: boolean;
	readonly atEnd: boolean;
}

/**
 * The runs of `tokens` that `keep` accepts, computed once per name: at
 * most `MAX_RUN_TOKENS` long, within the first and the last
 * `MAX_NAME_TOKENS / 2` tokens of a longer name (a run never spans the
 * cut), so the work per name is bounded whatever its shape.
 */
export function nameRuns(
	tokens: readonly string[],
	keep: (text: string) => boolean,
): NameRun[] {
	const count = tokens.length;
	const half = MAX_NAME_TOKENS / 2;
	const windows: [number, number][] =
		count <= MAX_NAME_TOKENS
			? [[0, count]]
			: [
					[0, half],
					[count - half, count],
				];
	const runs: NameRun[] = [];
	for (const [first, last] of windows) {
		for (let from = first; from < last; from += 1) {
			const end = Math.min(last, from + MAX_RUN_TOKENS);
			for (let to = from + 1; to <= end; to += 1) {
				const text = tokens.slice(from, to).join("");
				if (!keep(text)) continue;
				runs.push({ text, atStart: from === 0, atEnd: to === count });
			}
		}
	}
	return runs;
}
