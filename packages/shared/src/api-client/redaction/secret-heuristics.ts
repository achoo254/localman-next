/**
 * Values that look like a secret but are not marked as one: a plain
 * variable holding an API key, a token pasted into a script or a body.
 * Redaction never relies on this (it would miss some and hide too much);
 * the share dialog lists where they are before anything goes public.
 * Locations only, never the value.
 */
import type {
	CollectionTree,
	ImportedItem,
} from "../import/imported-collection.js";
import type {
	ApiRequestDraft,
	KeyValueRow,
	RequestScripts,
} from "../request-model.js";
import { VARIABLE_PATTERN } from "../variable-interpolation.js";
import type { PublicEnvironment } from "./public-collection.js";
import { isLiteralValue, isSensitiveName } from "./sensitive-names.js";

/** Known token formats: JWT, Stripe, GitHub, Slack, AWS, Google. */
const KNOWN_FORMATS: readonly RegExp[] = [
	/^eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*$/,
	/^(sk|rk)_(live|test)_\w{8,}$/,
	/^sk_\w{16,}$/,
	/^pk_live_\w{8,}$/,
	/^gh[pousr]_\w{20,}$/,
	/^github_pat_\w{20,}$/,
	/^xox[abpr]-[\w-]{10,}$/,
	/^AKIA[0-9A-Z]{16}$/,
	/^AIza[\w-]{30,}$/,
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_CHARS = /^[\w+/=.~-]+$/;
const LONG_TOKEN_MIN = 24;
/** Bits per character; English words and paths stay below it. */
const ENTROPY_MIN = 3.5;

function entropy(text: string): number {
	const counts = new Map<string, number>();
	for (const char of text) counts.set(char, (counts.get(char) ?? 0) + 1);
	let bits = 0;
	for (const count of counts.values()) {
		const share = count / text.length;
		bits -= share * Math.log2(share);
	}
	return bits;
}

/** Long, random-looking, letters and digits mixed, and not a UUID or a path. */
function looksRandom(word: string): boolean {
	if (word.length < LONG_TOKEN_MIN || !TOKEN_CHARS.test(word)) return false;
	if (UUID.test(word) || word.includes("/") || /^[\d.]+$/.test(word)) {
		return false;
	}
	const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((re) => re.test(word));
	return classes.length >= 2 && entropy(word) >= ENTROPY_MIN;
}

/** Splits code, JSON and header values into candidate words. */
const SEPARATORS = /[\s"'`(),;:<>[\]{}]+/;

/** Something in `value` (outside `{{var}}` references) looks like a secret. */
export function looksLikeSecret(value: string): boolean {
	const text = value.replace(VARIABLE_PATTERN, " ");
	return text
		.split(SEPARATORS)
		.some(
			(word) =>
				word !== "" &&
				(KNOWN_FORMATS.some((re) => re.test(word)) || looksRandom(word)),
		);
}

export const SECRET_LIKE_PLACES = [
	"collectionVariable",
	"environmentVariable",
	"script",
	"requestBody",
	"requestHeader",
	"exampleHeader",
	"url",
] as const;
export type SecretLikePlace = (typeof SECRET_LIKE_PLACES)[number];

export interface SecretLikeValue {
	where: SecretLikePlace;
	/** Folder names, then the request (and example) name; empty at the root. */
	path: string[];
	/** Variable, header or field name; `pre`/`post` for scripts; `body`, `url`. */
	key: string;
}

type Report = (where: SecretLikePlace, key: string, value: string) => void;

/** Rows redaction does not already blank: a credential name is hidden anyway. */
function scanRows(
	rows: readonly KeyValueRow[],
	where: SecretLikePlace,
	report: Report,
): void {
	for (const row of rows) {
		if (!isSensitiveName(row.key)) report(where, row.key, row.value);
	}
}

function scanScripts(scripts: RequestScripts, report: Report): void {
	report("script", "pre", scripts.pre);
	report("script", "post", scripts.post);
}

function scanDraft(draft: ApiRequestDraft, report: Report): void {
	// Path segments one by one: a whole URL never looks random.
	const path = draft.url.split(/[?#]/)[0] ?? "";
	report("url", "url", path.replace(/\//g, " "));
	// Fragment values (`#access_token=…`) one by one too.
	const hashAt = draft.url.indexOf("#");
	if (hashAt !== -1) {
		report("url", "url", draft.url.slice(hashAt + 1).replace(/[&=]/g, " "));
	}
	scanRows(draft.params, "url", report);
	scanRows(draft.headers, "requestHeader", report);
	report("requestBody", "body", draft.body.raw);
	for (const row of [...draft.body.urlencoded, ...draft.body.formData]) {
		if (!isSensitiveName(row.key)) report("requestBody", row.key, row.value);
	}
	scanScripts(draft.scripts, report);
}

function scanItems(
	items: readonly ImportedItem[],
	path: string[],
	found: SecretLikeValue[],
): void {
	for (const item of items) {
		const here = [...path, item.name];
		const report: Report = (where, key, value) => {
			if (looksLikeSecret(value)) found.push({ where, path: here, key });
		};
		if (item.kind === "folder") {
			scanScripts(item.scripts, report);
			scanItems(item.items, here, found);
			continue;
		}
		scanDraft(item.draft, report);
		for (const example of item.examples) {
			const at = [...here, example.name];
			const reportExample: Report = (where, key, value) => {
				if (looksLikeSecret(value)) found.push({ where, path: at, key });
			};
			scanDraft(example.request, reportExample);
			scanRows(example.response.headers, "exampleHeader", reportExample);
		}
	}
}

/** Where a collection (and its environment) holds secret-looking values. */
export function findSecretLikeValues(
	tree: CollectionTree,
	environment?: PublicEnvironment,
): SecretLikeValue[] {
	const found: SecretLikeValue[] = [];
	const atRoot: Report = (where, key, value) => {
		if (looksLikeSecret(value)) found.push({ where, path: [], key });
	};
	// A plain variable named like a credential is published as it is, so it
	// warns whatever its value looks like.
	const variable = (where: SecretLikePlace, key: string, value: string) => {
		if (isSensitiveName(key) && isLiteralValue(value)) {
			found.push({ where, path: [], key });
		} else atRoot(where, key, value);
	};
	for (const entry of tree.variables) {
		if (entry.secret !== true) {
			variable("collectionVariable", entry.key, entry.value);
		}
	}
	for (const entry of environment?.variables ?? []) {
		variable("environmentVariable", entry.key, entry.value);
	}
	scanScripts(tree.scripts, atRoot);
	scanItems(tree.items, [], found);
	return found;
}
