/**
 * One OpenAPI operation to a request: `{{baseUrl}}` + path (path params
 * filled with their example, else left as `{{name}}`), query, header and
 * cookie params (required ones enabled), body and security.
 */
import {
	type EffectiveAuth,
	type HttpMethod,
	type KeyValueRow,
	createRequestDraft,
} from "../request-model.js";
import { buildUrlWithParams } from "../url-params.js";
import { type ImportContext, clampDraft } from "./import-context.js";
import { paramText } from "./import-error.js";
import {
	type JsonRecord,
	descriptionOf,
	keysOf,
	listProp,
	prop,
	recordProp,
	textProp,
} from "./import-json.js";
import type { ImportedRequest } from "./imported-collection.js";
import { readRequestBody } from "./openapi-body.js";
import { declaredExample, derefLocal, exampleText } from "./openapi-example.js";

export interface OpenApiOperation {
	path: string;
	method: HttpMethod;
	pathItem: unknown;
	operation: JsonRecord;
}

/** Headers OpenAPI forbids as parameters (they come from body and auth). */
const IGNORED_HEADERS = new Set(["accept", "content-type", "authorization"]);

/** Path-level and operation-level parameters; the operation's win. */
function parameters(
	root: JsonRecord,
	op: OpenApiOperation,
	ctx: ImportContext,
	path: string,
): unknown[] {
	const byKey = new Map<string, unknown>();
	const all = [
		...listProp(op.pathItem, "parameters"),
		...listProp(op.operation, "parameters"),
	];
	for (const raw of all) {
		const param = derefLocal(root, raw, ctx, path);
		const key = `${textProp(param, "in")}:${textProp(param, "name")}`;
		if (textProp(param, "name")) byKey.set(key, param);
	}
	return [...byKey.values()];
}

/** `example`, the first of `examples`, or what the schema declares. */
function paramExample(
	root: JsonRecord,
	param: unknown,
	ctx: ImportContext,
	path: string,
): unknown {
	const own = prop(param, "example");
	if (own !== undefined) return own;
	const examples = recordProp(param, "examples");
	const first = keysOf(examples)[0];
	const named =
		first === undefined
			? undefined
			: prop(derefLocal(root, prop(examples, first), ctx, path), "value");
	if (named !== undefined) return named;
	return declaredExample(derefLocal(root, prop(param, "schema"), ctx, path));
}

/** Auth of a security requirement list; `[]` means no auth. */
export function authFromSecurity(
	root: JsonRecord,
	requirements: readonly unknown[],
	ctx: ImportContext,
	path: string,
): EffectiveAuth {
	const name = keysOf(requirements[0])[0];
	if (name === undefined) return { type: "none" };
	const schemes = recordProp(recordProp(root, "components"), "securitySchemes");
	const scheme = derefLocal(root, prop(schemes, name), ctx, path);
	const type = textProp(scheme, "type");
	const httpScheme = textProp(scheme, "scheme").toLowerCase();
	const where = textProp(scheme, "in");
	if (type === "http" && httpScheme === "bearer") {
		return { type: "bearer", token: "" };
	}
	if (type === "http" && httpScheme === "basic") {
		return { type: "basic", username: "", password: "" };
	}
	if (type === "oauth2" || type === "openIdConnect") {
		return { type: "bearer", token: "" };
	}
	if (type === "apiKey" && (where === "header" || where === "query")) {
		return {
			type: "apikey",
			key: textProp(scheme, "name"),
			value: "",
			in: where,
		};
	}
	ctx.warn("UNSUPPORTED_AUTH", path, {
		type: paramText(`${type} ${httpScheme || where}`.trim()),
	});
	return { type: "none" };
}

export function operationToRequest(
	root: JsonRecord,
	op: OpenApiOperation,
	ctx: ImportContext,
	path: string,
): ImportedRequest {
	let urlPath = op.path;
	const query: KeyValueRow[] = [];
	const headers: KeyValueRow[] = [];
	const cookies: string[] = [];
	for (const param of parameters(root, op, ctx, path)) {
		const name = textProp(param, "name");
		const where = textProp(param, "in");
		const example = paramExample(root, param, ctx, path);
		const value = exampleText(example);
		const enabled = prop(param, "required") === true;
		if (where === "path") {
			const filled =
				example === undefined ? `{{${name}}}` : encodeURIComponent(value);
			urlPath = urlPath.split(`{${name}}`).join(filled);
		} else if (where === "query") {
			query.push({ id: ctx.newId(), key: name, value, enabled });
		} else if (where === "header" && !IGNORED_HEADERS.has(name.toLowerCase())) {
			headers.push({ id: ctx.newId(), key: name, value, enabled });
		} else if (where === "cookie") cookies.push(`${name}=${value}`);
	}
	if (cookies.length > 0) {
		headers.push({
			id: ctx.newId(),
			key: "Cookie",
			value: cookies.join("; "),
			enabled: true,
		});
	}
	const { body, contentType } = readRequestBody(
		root,
		prop(op.operation, "requestBody"),
		ctx,
		path,
	);
	if (contentType !== null) {
		headers.push({
			id: ctx.newId(),
			key: "Content-Type",
			value: contentType,
			enabled: true,
		});
	}
	const security = prop(op.operation, "security");
	const name =
		textProp(op.operation, "summary") ||
		textProp(op.operation, "operationId") ||
		`${op.method} ${op.path}`;
	const draft = createRequestDraft({
		name,
		method: op.method,
		url: buildUrlWithParams(`{{baseUrl}}${urlPath}`, query),
		params: query,
		headers,
		auth: Array.isArray(security)
			? authFromSecurity(root, security, ctx, path)
			: { type: "inherit" },
		body,
	});
	return {
		kind: "request",
		id: ctx.newId(),
		name: draft.name,
		description: descriptionOf(prop(op.operation, "description")),
		draft: clampDraft(draft, ctx, path),
	};
}
