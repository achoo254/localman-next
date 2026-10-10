import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isRecord } from "../../lib/json-guards";
import { findToast } from "../../test/toast";
import { settingsJson } from "../request-log/request-log-test-utils";
import { BASE, renderUpstream } from "./upstream-test-utils";

describe("masked headers", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("adds and removes masked headers on top of the fixed ones", async () => {
		const { calls } = renderUpstream(
			{ redactHeaders: ["x-session"] },
			{
				[`PUT ${BASE}/redact-headers`]: (call) => ({
					body: settingsJson({
						redactHeaders: isRecord(call.body) ? call.body.headers : [],
					}),
				}),
			},
		);
		const user = userEvent.setup();
		expect(await screen.findByText("x-api-key")).toBeVisible();
		await user.type(screen.getByLabelText("Header name"), "Cookie{Enter}");
		expect(
			await screen.findByText("This header is already masked."),
		).toBeVisible();
		await user.clear(screen.getByLabelText("Header name"));
		await user.type(
			screen.getByLabelText("Header name"),
			"X-Tenant-Token{Enter}",
		);
		await findToast("Saved the masked headers.");
		await user.click(
			await screen.findByRole("button", { name: "Stop masking x-session" }),
		);
		const puts = calls
			.filter((call) => call.method === "PUT")
			.map((call) => call.body);
		expect(puts).toEqual([
			{ headers: ["x-session", "x-tenant-token"] },
			{ headers: ["x-tenant-token"] },
		]);
	});
});
