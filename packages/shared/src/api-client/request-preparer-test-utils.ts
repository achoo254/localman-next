/** Fixtures shared by the request preparer tests. */
import {
	type ApiRequestDraft,
	type RequestBody,
	createRequestDraft,
	emptyRequestBody,
} from "./request-model.js";
import type { PrepareOptions, prepareRequest } from "./request-preparer.js";
export function baseRequest(
	overrides: Partial<ApiRequestDraft> = {},
): ApiRequestDraft {
	return createRequestDraft({
		url: "https://api.example.com/path",
		...overrides,
	});
}

export const body = (overrides: Partial<RequestBody>): RequestBody => ({
	...emptyRequestBody(),
	...overrides,
});

export const row = (key: string, value: string, enabled = true) => ({
	id: key,
	key,
	value,
	enabled,
});

export const bodyText = (
	prepared: ReturnType<typeof prepareRequest>,
): string => {
	if (prepared.body.kind === "text") return prepared.body.text;
	if (prepared.body.kind === "bytes") {
		return new TextDecoder().decode(prepared.body.bytes);
	}
	return "";
};

export const secretOptions: PrepareOptions = {
	variables: {
		scopes: [
			{
				variables: [
					{ key: "baseUrl", value: "https://api.example.com" },
					{ key: "token", value: "s3cret", secret: true },
					{ key: "pass", value: "pw", secret: true },
				],
			},
		],
	},
};
