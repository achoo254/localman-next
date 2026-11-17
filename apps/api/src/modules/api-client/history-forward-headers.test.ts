import { createRequestDraft } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { HistoryModel } from "./history-model.js";
import { recordHistoryEntry } from "./history-service.js";

useDashboardTestDb();

const row = (key: string, value: string) => ({
	id: key,
	key,
	value,
	enabled: true,
});

describe("history of a request to a machine", () => {
	it("never keeps tunelo-* headers, which may hold a link token", async () => {
		const draft = createRequestDraft({
			url: "http://localhost:5173/api",
			headers: [
				row("Accept", "application/json"),
				row("Tunelo-Access", "tunelo_secret_link_token"),
				row("tunelo-local-port", "5173"),
			],
		});
		await recordHistoryEntry("acc_history", draft, {
			status: 200,
			ms: 5,
			size: 2,
			route: "tunnel",
			finalUrl: "https://m-1.tunnel.hoandat.com/.tunelo/forward/api?q=1",
		});
		const stored = await HistoryModel.findOne({
			userSub: "acc_history",
		}).lean();
		expect(JSON.stringify(stored)).not.toContain("tunelo_secret_link_token");
		expect(stored?.draft.headers).toEqual([row("Accept", "application/json")]);
		expect(stored?.response?.finalUrl).toBe(
			"https://m-1.tunnel.hoandat.com/.tunelo/forward/api",
		);
	});
});
