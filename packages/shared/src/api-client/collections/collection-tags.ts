/**
 * Tags and the status tag of a collection, with Postman's rules: at most
 * 10 tags of 1-64 characters, compared without case (stored lower-case),
 * starting and ending with a letter or digit; a status is a preset or a
 * custom name of 2-64 characters starting with a letter plus one emoji.
 * Text is NFC-normalized; control, format and separator characters are
 * refused, and an emoji is one grapheme of at most 16 code points.
 * `collection-model.ts` re-exports the limits and types.
 */
import { z } from "zod";

export const COLLECTION_TAGS_MAX = 10;
export const COLLECTION_TAG_MAX_LENGTH = 64;
export const COLLECTION_STATUS_PRESETS = [
	"stable",
	"in-development",
	"in-review",
	"deprecated",
] as const;
export type CollectionStatusPreset = (typeof COLLECTION_STATUS_PRESETS)[number];

/** Status tag of a collection: one preset, or a custom name with an emoji. */
export type CollectionStatus =
	| { kind: "preset"; preset: CollectionStatusPreset }
	| { kind: "custom"; name: string; emoji: string };

export const STATUS_NAME_MIN = 2;
export const STATUS_NAME_MAX = 64;

export type TagProblemCode =
	| "empty"
	| "too-long"
	| "edges"
	| "characters"
	| "too-many";
export interface TagProblem {
	/** The tag as sent (after trimming); "" for `too-many`. */
	tag: string;
	code: TagProblemCode;
}

export type StatusProblem =
	| "unknown-preset"
	| "name-length"
	| "name-start"
	| "name-characters"
	| "emoji";

/** Letters (any script) or digits at both ends; one character counts too. */
const TAG_EDGES = /^[\p{L}\p{N}](?:.*[\p{L}\p{N}])?$/su;
const STARTS_WITH_LETTER = /^\p{L}/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
/** Control, format (zero-width, bidi) and line or paragraph separators. */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
/** Longest emoji grapheme accepted (family sequences use 7-11 code points). */
export const EMOJI_MAX_CODE_POINTS = 16;
/** Emoji outside Extended_Pictographic: flags (two regional indicators) and keycaps. */
const FLAG_OR_KEYCAP = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3)$/u;

/** Length in characters (code points), as people count them. */
function length(text: string): number {
	return [...text].length;
}

function tagProblem(tag: string): TagProblemCode | null {
	if (tag.length === 0) return "empty";
	if (length(tag) > COLLECTION_TAG_MAX_LENGTH) return "too-long";
	if (INVISIBLE.test(tag)) return "characters";
	if (!TAG_EDGES.test(tag)) return "edges";
	return null;
}

/**
 * Tags trimmed, lower-cased and without repeats, in the order sent, with
 * what breaks the rules (the tags are valid when `problems` is empty).
 */
export function normalizeTags(tags: readonly string[]): {
	tags: string[];
	problems: TagProblem[];
} {
	const unique = [
		...new Set(tags.map((tag) => tag.normalize("NFC").trim().toLowerCase())),
	];
	const problems: TagProblem[] = [];
	for (const tag of unique) {
		const code = tagProblem(tag);
		if (code) problems.push({ tag, code });
	}
	if (unique.length > COLLECTION_TAGS_MAX) {
		problems.push({ tag: "", code: "too-many" });
	}
	return { tags: unique, problems };
}

/** Whether `text` is exactly one emoji (one grapheme, pictographic). */
export function isSingleEmoji(text: string): boolean {
	const segments = [
		...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
	];
	const [only] = segments;
	if (segments.length !== 1 || only === undefined) return false;
	if (length(only.segment) > EMOJI_MAX_CODE_POINTS) return false;
	return PICTOGRAPHIC.test(only.segment) || FLAG_OR_KEYCAP.test(only.segment);
}

/** What breaks the status rules, `null` when it is valid. */
export function validateStatus(status: CollectionStatus): StatusProblem | null {
	if (status.kind === "preset") {
		const presets: readonly string[] = COLLECTION_STATUS_PRESETS;
		return presets.includes(status.preset) ? null : "unknown-preset";
	}
	const name = status.name.normalize("NFC").trim();
	if (length(name) < STATUS_NAME_MIN || length(name) > STATUS_NAME_MAX) {
		return "name-length";
	}
	if (INVISIBLE.test(name)) return "name-characters";
	if (!STARTS_WITH_LETTER.test(name)) return "name-start";
	return isSingleEmoji(status.emoji) ? null : "emoji";
}

/** Tags as sent; parses to the normalized list or fails with each problem. */
export const collectionTagsSchema = z
	.array(z.string().max(COLLECTION_TAG_MAX_LENGTH * 4))
	.max(COLLECTION_TAGS_MAX * 5)
	.superRefine((tags, ctx) => {
		for (const problem of normalizeTags(tags).problems) {
			ctx.addIssue({
				code: "custom",
				message: `Tag "${problem.tag}": ${problem.code}`,
				params: { tagProblem: problem.code },
			});
		}
	})
	.transform((tags) => normalizeTags(tags).tags);

export const collectionStatusSchema: z.ZodType<CollectionStatus> = z
	.discriminatedUnion("kind", [
		z.object({
			kind: z.literal("preset"),
			preset: z.enum(COLLECTION_STATUS_PRESETS),
		}),
		z.object({
			kind: z.literal("custom"),
			name: z
				.string()
				.max(STATUS_NAME_MAX * 4)
				.transform((name) => name.normalize("NFC").trim()),
			emoji: z.string().max(64),
		}),
	])
	.superRefine((status, ctx) => {
		const problem = validateStatus(status);
		if (problem) {
			ctx.addIssue({
				code: "custom",
				message: `Status: ${problem}`,
				params: { statusProblem: problem },
			});
		}
	});
