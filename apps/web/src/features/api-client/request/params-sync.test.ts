import {
	type KeyValueRow,
	createRequestDraft,
	paramsFromUrl,
	prepareRequest,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { withVerbatimQuery } from "./params-sync";

let counter = 0;
const newId = () => `id${++counter}`;
const row = (key: string, value: string, enabled = true): KeyValueRow => ({
	id: `r-${key}`,
	key,
	value,
	enabled,
});

describe("withVerbatimQuery", () => {
	it("sends the URL as typed once params mirror it", () => {
		const url = "https://a.test/p?wsdl&path=~/x,y";
		const draft = createRequestDraft({
			url,
			params: paramsFromUrl(url, [], newId),
		});
		expect(prepareRequest(withVerbatimQuery(draft)).url).toBe(url);
		// Without it, the preparer rebuilds the query from the params.
		expect(prepareRequest(draft).url).not.toBe(url);
	});

	it("leaves drafts whose query uses {{var}} or differs from the params", () => {
		const withVar = createRequestDraft({
			url: "https://a.test/?id={{id}}",
			params: [row("id", "{{id}}")],
		});
		expect(withVerbatimQuery(withVar)).toBe(withVar);
		const stale = createRequestDraft({
			url: "https://a.test/?a=1",
			params: [row("a", "2")],
		});
		expect(withVerbatimQuery(stale)).toBe(stale);
	});
});
