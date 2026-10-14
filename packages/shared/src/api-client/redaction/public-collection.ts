/**
 * The only shape of a collection or environment that leaves the
 * workspace: the public link page, the guest page, the JSON an access key
 * reads and what a Run button imports are all built here, on the server,
 * never from the internal view of a collection.
 *
 * Hidden: values of `secret` variables, credentials typed into the
 * Authorization tab of the collection, a folder, a request or the request
 * of an example, literal values of headers and query params whose name
 * says credential (`Set-Cookie` included) and such form fields and URL
 * fragment pairs, `user:password@` in URLs (response `Location` included),
 * and every example's response body. Environments keep only shared values of
 * variables that are not `secret`; local values never come in.
 * `{{var}}` references stay as typed. Bodies, paths and scripts are kept
 * and only warned about (`secret-heuristics.ts`).
 */
import type { ExampleResponse } from "../collections/collection-model.js";
import type { SharedVariable } from "../environments/environment-model.js";
import type {
	CollectionTree,
	ImportedExample,
	ImportedItem,
} from "../import/imported-collection.js";
import type {
	EffectiveAuth,
	KeyValueRow,
	RequestAuth,
} from "../request-model.js";
import type { VariableEntry } from "../variable-interpolation.js";
import { redactAuth, redactDraft, redactUrl } from "./redact-draft.js";
import { isSensitiveName } from "./sensitive-names.js";

/** Collection auth never holds `inherit`, and redaction keeps the type. */
function redactEffectiveAuth(auth: EffectiveAuth): EffectiveAuth {
	const redacted: RequestAuth = redactAuth(auth);
	return redacted.type === "inherit" ? auth : redacted;
}

/** Response headers holding a URL (a redirect can carry `?access_token=`). */
const URL_HEADERS: ReadonlySet<string> = new Set([
	"location",
	"content-location",
]);

/**
 * A response header named like a credential loses its value whatever it
 * is; a URL-valued one loses the credentials in it.
 */
function redactResponseHeader(row: KeyValueRow): KeyValueRow {
	if (isSensitiveName(row.key)) {
		return row.value === "" ? row : { ...row, value: "" };
	}
	if (!URL_HEADERS.has(row.key.trim().toLowerCase())) return row;
	const value = redactUrl(row.value);
	return value === row.value ? row : { ...row, value };
}

function publicResponse(response: ExampleResponse): ExampleResponse {
	return {
		...response,
		headers: response.headers.map(redactResponseHeader),
		body: "",
	};
}

function publicExample(example: ImportedExample): ImportedExample {
	return {
		...example,
		request: redactDraft(example.request),
		response: publicResponse(example.response),
	};
}

function publicItem(item: ImportedItem): ImportedItem {
	if (item.kind === "folder") {
		return {
			...item,
			auth: redactAuth(item.auth),
			items: item.items.map(publicItem),
		};
	}
	return {
		...item,
		draft: redactDraft(item.draft),
		examples: item.examples.map(publicExample),
	};
}

function publicVariable(variable: VariableEntry): VariableEntry {
	return variable.secret === true ? { ...variable, value: "" } : variable;
}

/** The collection as anyone outside the workspace may see it. */
export function publicCollectionTree(tree: CollectionTree): CollectionTree {
	return {
		...tree,
		auth: redactEffectiveAuth(tree.auth),
		variables: tree.variables.map(publicVariable),
		items: tree.items.map(publicItem),
	};
}

/** What a stored environment holds, before redaction. */
export interface EnvironmentSource {
	name: string;
	variables: readonly SharedVariable[];
}

export interface PublicEnvironment {
	name: string;
	variables: VariableEntry[];
}

/** Shared values of variables that are not `secret`; nothing else. */
export function publicEnvironment(env: EnvironmentSource): PublicEnvironment {
	const variables: VariableEntry[] = [];
	for (const variable of env.variables) {
		if (variable.type === "secret" || variable.sharedValue === null) continue;
		const entry: VariableEntry = {
			key: variable.key,
			value: variable.sharedValue,
		};
		if (!variable.enabled) entry.enabled = false;
		variables.push(entry);
	}
	return { name: env.name, variables };
}
