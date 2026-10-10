import { z } from "zod";

export const PROJECT_NAME_MAX = 60;
export const PROJECT_PREFIX_MAX = 100;

/**
 * Starts with a letter (Vietnamese included, any script) or a digit, then
 * letters, combining marks, digits, `_`, space and `-` as in mockapi.io,
 * parentheses so a clone named "Demo (copy)" stays editable without
 * renaming it, and `. · , & + ' :` for names like "Shop v2.0" or
 * "R&D: Shop · Admin". The name is display text only: the MCP server name
 * and every file name are slugs built from it, never the name itself.
 */
export const PROJECT_NAME_PATTERN =
	/^[\p{L}\p{N}][\p{L}\p{M}\p{N}_ ().·,&+':-]*$/u;

/** Word characters, `-` and `/` (mockapi.io). */
export const PROJECT_PREFIX_PATTERN = /^[\w\-/]*$/;

/**
 * Canonical prefix: one leading `/`, no trailing or repeated `/`
 * (`api/v1/` → `/api/v1`). Empty or slash-only input means no prefix.
 */
export function normalizePrefix(raw: string): string {
	const segments = raw
		.trim()
		.split("/")
		.filter((segment) => segment !== "");
	return segments.length === 0 ? "" : `/${segments.join("/")}`;
}

export const projectNameSchema = z
	.string()
	.trim()
	.normalize("NFC")
	.min(1, "Name is required")
	.max(PROJECT_NAME_MAX, `Name must be at most ${PROJECT_NAME_MAX} characters`)
	.regex(
		PROJECT_NAME_PATTERN,
		"Name must start with a letter or digit and contain only letters, digits, spaces and the characters - _ ( ) . · , & + ' :",
	);

export const projectPrefixSchema = z
	.string()
	.trim()
	.max(
		PROJECT_PREFIX_MAX,
		`Prefix must be at most ${PROJECT_PREFIX_MAX} characters`,
	)
	.regex(
		PROJECT_PREFIX_PATTERN,
		"Prefix may contain letters, digits, _, - and / only",
	)
	.transform(normalizePrefix);

/** Body of create and update; the prefix comes out normalized. */
export const projectInputSchema = z.object({
	name: projectNameSchema,
	prefix: projectPrefixSchema.default(""),
});

export type ProjectInput = z.output<typeof projectInputSchema>;
