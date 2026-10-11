/**
 * The v2.1 `request` object of an item or of a saved example, its auth
 * (left out for `inherit`), and the examples (`response[]`) of an item.
 * An example's request has no scripts or settings in v2.1: only the
 * request fields are written.
 */
import type {
	CollectionV21Auth,
	CollectionV21Request,
	CollectionV21Response,
} from "../import/collection-v21-types.js";
import type { ImportedExample } from "../import/imported-collection.js";
import type { ApiRequestDraft, RequestAuth } from "../request-model.js";
import { bodyToV21, rowsToV21 } from "./collection-v21-body-export.js";
import { collectionV21Url } from "./collection-v21-url.js";

const attribute = (key: string, value: string) =>
	({ key, value, type: "string" }) as const;

export function authToV21(auth: RequestAuth): CollectionV21Auth | undefined {
	switch (auth.type) {
		case "inherit":
			return undefined;
		case "none":
			return { type: "noauth" };
		case "bearer":
			return { type: "bearer", bearer: [attribute("token", auth.token)] };
		case "basic":
			return {
				type: "basic",
				basic: [
					attribute("username", auth.username),
					attribute("password", auth.password),
				],
			};
		case "apikey":
			return {
				type: "apikey",
				apikey: [
					attribute("key", auth.key),
					attribute("value", auth.value),
					attribute("in", auth.in),
				],
			};
	}
}

export function requestObjectToV21(
	draft: ApiRequestDraft,
	description: string,
): CollectionV21Request {
	const request: CollectionV21Request = {
		method: draft.method,
		header: rowsToV21(draft.headers),
		url: collectionV21Url(draft.url, rowsToV21(draft.params)),
	};
	const body = bodyToV21(draft.body);
	const auth = authToV21(draft.auth);
	if (body) request.body = body;
	if (auth) request.auth = auth;
	if (description) request.description = description;
	return request;
}

export function examplesToV21(
	examples: readonly ImportedExample[],
): CollectionV21Response[] {
	return examples.map(({ name, request, response }) => ({
		name,
		originalRequest: requestObjectToV21(request, ""),
		status: response.statusText,
		code: response.status,
		header: rowsToV21(response.headers),
		body: response.body,
		_postman_previewlanguage: response.bodyLanguage,
	}));
}
