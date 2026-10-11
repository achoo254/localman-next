/**
 * Example responses (pure): one saved from a received response, or a
 * blank one for "Add example".
 */
import type {
	ClientResponse,
	ExampleResponse,
	RawLanguage,
} from "@localman/shared/api-client";

/** The editor language of a body, from its `Content-Type`. */
export function languageOf(contentType: string): RawLanguage {
	const type = contentType.toLowerCase();
	if (type.includes("json")) return "json";
	if (type.includes("html")) return "html";
	if (type.includes("xml")) return "xml";
	if (type.includes("javascript")) return "javascript";
	return "text";
}

/**
 * A received response as an example: status, headers in order and the
 * text body (a binary body is not kept). The caller cuts it to fit.
 */
export function exampleFromResponse(
	response: ClientResponse,
	newId: () => string,
): ExampleResponse {
	const contentType =
		response.headers.find((h) => h.name.toLowerCase() === "content-type")
			?.value ?? "";
	return {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers.map((header) => ({
			id: newId(),
			key: header.name,
			value: header.value,
			enabled: true,
		})),
		body: response.bodyEncoding === "base64" ? "" : response.body,
		bodyLanguage: languageOf(contentType),
	};
}

/** Default name of an example saved from a response: "200 OK". */
export function exampleName(response: ExampleResponse): string {
	return `${response.status} ${response.statusText}`.trim();
}

export function blankExampleResponse(): ExampleResponse {
	return {
		status: 200,
		statusText: "OK",
		headers: [],
		body: "",
		bodyLanguage: "json",
	};
}
