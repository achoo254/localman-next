import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isRecord } from "../../lib/json-guards";
import { held } from "../../pages/project-detail/project-detail-test-helpers";
import { findToast } from "../../test/toast";
import { settingsJson } from "../request-log/request-log-test-utils";
import { BASE, renderUpstream } from "./upstream-test-utils";

describe("masked headers", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("adds and removes masked headers on top of the fixed ones", async () => {
		// The server keeps the list: a refetch after a save returns it.
		let stored: unknown = ["x-session"];
		const { calls } = renderUpstream(
			{ redactHeaders: stored },
			{
				[`GET ${BASE}/traffic-settings`]: () => ({
					body: settingsJson({ redactHeaders: stored }),
				}),
				[`PUT ${BASE}/redact-headers`]: (call) => {
					stored = isRecord(call.body) ? call.body.headers : [];
					return { body: settingsJson({ redactHeaders: stored }) };
				},
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

	it("shows a new header at once and takes it back when the save fails", async () => {
		const save = held();
		renderUpstream(
			{ redactHeaders: [] },
			{ [`PUT ${BASE}/redact-headers`]: save.route },
		);
		const user = userEvent.setup();
		const input = await screen.findByLabelText("Header name");
		await user.type(input, "X-Tenant{Enter}");
		// Before the server answers: the chip is there and the input is free.
		expect(
			await screen.findByRole("button", { name: "Stop masking x-tenant" }),
		).toBeInTheDocument();
		expect(input).toHaveValue("");
		await act(async () =>
			save.release({
				status: 500,
				body: { error: { code: "INTERNAL", message: "Server down." } },
			}),
		);
		expect(await findToast("Couldn't save the masked headers")).toBeVisible();
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Stop masking x-tenant" }),
			).toBeNull(),
		);
		expect(input).toHaveValue("x-tenant");
	});
});
