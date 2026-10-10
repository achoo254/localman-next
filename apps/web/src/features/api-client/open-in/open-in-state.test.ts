import { describe, expect, it } from "vitest";
import { openInApiClientState, readOpenInApiClient } from "./open-in-state";

describe("readOpenInApiClient", () => {
	it("reads back the ids written by openInApiClientState", () => {
		for (const target of [
			{ projectId: "p1" },
			{ projectId: "p1", resourceId: "r1" },
			{ projectId: "p1", logId: "l1" },
		]) {
			expect(readOpenInApiClient(openInApiClientState(target))).toEqual(target);
		}
	});

	it("refuses drafts, bad ids and a resource together with a log line", () => {
		const read = (target: unknown) =>
			readOpenInApiClient({ openInApiClient: target });
		expect(read({ draft: { url: "https://a.test" } })).toBeNull();
		expect(read({ projectId: "p 1" })).toBeNull();
		expect(read({ projectId: "p1", logId: "../x" })).toBeNull();
		expect(read({ projectId: "p1", resourceId: "r1", logId: "l1" })).toBeNull();
		expect(readOpenInApiClient(null)).toBeNull();
	});
});
