/**
 * The Parent ID field of a nested resource's records (`userId` under
 * `users`). A resource stores the key it was given when it was created or
 * moved under a parent, from `parentKeyOf` or chosen by the user; a
 * resource stored before keys were stored has none and keeps the key the
 * old rule (`legacyParentKeyOf`) builds from its parent's current name,
 * so existing mock clients see the same field. Zod-free.
 */
import { FORBIDDEN_KEYS } from "./json-value.js";
import { OBJECT_ID_FIELD } from "./resource-constants.js";

export const PARENT_KEY_MAX = 64;
/** A JavaScript identifier, so clients can write `record.userId`. */
export const PARENT_KEY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Plurals the suffix rules get wrong, and words that are their own plural. */
const IRREGULAR: ReadonlyMap<string, string> = new Map([
	["people", "person"],
	["children", "child"],
	["men", "man"],
	["women", "woman"],
	["mice", "mouse"],
	["geese", "goose"],
	["feet", "foot"],
	["teeth", "tooth"],
	["indices", "index"],
	["vertices", "vertex"],
	["matrices", "matrix"],
	["appendices", "appendix"],
	["criteria", "criterion"],
	["phenomena", "phenomenon"],
	["analyses", "analysis"],
	["crises", "crisis"],
	["diagnoses", "diagnosis"],
	["heroes", "hero"],
	["potatoes", "potato"],
	["tomatoes", "tomato"],
	["echoes", "echo"],
	["buses", "bus"],
	["statuses", "status"],
	["quizzes", "quiz"],
	["leaves", "leaf"],
	["lives", "life"],
	["knives", "knife"],
	["wives", "wife"],
	["halves", "half"],
	["shelves", "shelf"],
	["wolves", "wolf"],
	["movies", "movie"],
	["cookies", "cookie"],
	["pies", "pie"],
	["ties", "tie"],
	["uses", "use"],
	["abuses", "abuse"],
	["excuses", "excuse"],
	["series", "series"],
	["species", "species"],
	["news", "news"],
	["data", "data"],
	["media", "media"],
	["metadata", "metadata"],
	["sheep", "sheep"],
	["fish", "fish"],
	["deer", "deer"],
]);

/** Suffix rules, first match wins: `[pattern, characters to drop, ending]`. */
const SUFFIX_RULES: readonly (readonly [RegExp, number, string])[] = [
	[/zzes$/i, 3, ""], // quizzes → quiz
	[/[aeiou]uses$/i, 1, ""], // houses → house
	[/uses$/i, 2, ""], // statuses → status
	[/(?:yses|[^e]eses)$/i, 2, "is"], // analyses → analysis, theses → thesis
	[/ies$/i, 3, "y"], // categories → category
	[/(?:sses|xes|ches|shes)$/i, 2, ""], // addresses, boxes, matches, dishes
	[/(?:ss|us|is)$/i, 0, ""], // address, status, analysis stay
	[/s$/i, 1, ""], // users → user
];

/** The table's singular in the word's case (`People` → `Person`). */
function irregular(word: string): string | undefined {
	const singular = IRREGULAR.get(word.toLowerCase());
	if (singular === undefined) return undefined;
	if (word === word.toUpperCase()) return singular.toUpperCase();
	if (word.charAt(0) !== word.charAt(0).toLowerCase()) {
		return singular.charAt(0).toUpperCase() + singular.slice(1);
	}
	return singular;
}

/** English singular of one word: the table, then the suffix rules. */
export function singularize(word: string): string {
	const known = irregular(word);
	if (known !== undefined) return known;
	for (const [pattern, drop, ending] of SUFFIX_RULES) {
		if (!pattern.test(word)) continue;
		const singular = `${word.slice(0, word.length - drop)}${ending}`;
		return singular || word;
	}
	return word;
}

/**
 * Key a resource gets when it is created or moved under `parentName`:
 * the name in camelCase (`-` and `_` start a new word) with its last word
 * singular, then `Id`. `order-items` → `orderItemId`, `people` →
 * `personId`. A name starting with a digit gets a leading `_`, so the key
 * is always a JavaScript identifier.
 */
export function parentKeyOf(parentName: string): string {
	const parts = parentName.split(/[-_]+/).filter((part) => part !== "");
	const last = parts.length - 1;
	const words = parts.map((part, index) => {
		const word = index === last ? singularize(part) : part;
		return index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
	});
	const key = `${words.join("")}Id`;
	return /^[A-Za-z_$]/.test(key) ? key : `_${key}`;
}

/**
 * The rule resources stored before keys were stored still follow:
 * `-ies`, `-es` and `-s` only, name kept as is (`blog-posts` →
 * `blog-postId`). Never used for new keys.
 */
export function legacyParentKeyOf(parentName: string): string {
	return `${legacySingular(parentName) || parentName}Id`;
}

function legacySingular(name: string): string {
	if (/ies$/i.test(name)) return `${name.slice(0, -3)}y`;
	if (/(?:ss|sh|ch|x|z)es$/i.test(name)) return name.slice(0, -2);
	if (/(?:ss|us|is)$/i.test(name)) return name;
	if (/s$/i.test(name)) return name.slice(0, -1);
	return name;
}

/**
 * The Parent ID field of a nested resource under a parent named
 * `parentName`: its stored key, else the old rule. Every reader of the
 * key (mock routes, filters, generated records, exports, MCP) goes
 * through this function. A root resource has no key; callers check that.
 */
export function resourceParentKey(
	resource: { readonly parentKey?: string | null },
	parentName: string,
): string {
	return resource.parentKey ?? legacyParentKeyOf(parentName);
}

/** Why `key` cannot be a Parent ID chosen by the user, or `null`. */
export function parentKeyIssue(key: string): string | null {
	if (key.length === 0 || key.length > PARENT_KEY_MAX) {
		return `Parent ID must be 1 to ${PARENT_KEY_MAX} characters`;
	}
	if (!PARENT_KEY_PATTERN.test(key)) {
		return "Parent ID must start with a letter, _ or $ and contain only letters, digits, _ and $";
	}
	if (key === OBJECT_ID_FIELD) {
		return `"${OBJECT_ID_FIELD}" is the record's own id`;
	}
	if (FORBIDDEN_KEYS.includes(key)) {
		return `Parent ID cannot be ${FORBIDDEN_KEYS.join(", ")}`;
	}
	return null;
}
