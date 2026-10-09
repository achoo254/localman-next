import { createRequestDraft } from "@localman/shared/api-client";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type FetchCall, mockFetch } from "../../../test/mock-fetch";
import { byDataId, renderWorkbench } from "./workbench-test-utils";

afterEach(() => vi.unstubAllGlobals());

const NO_DRAFTS = { "GET /api/v1/client/drafts": { body: { items: [] } } };

function saves(calls: readonly FetchCall[]): FetchCall[] {
	return calls.filter(
		(call) =>
			call.method === "PUT" && call.path.startsWith("/api/v1/client/drafts/"),
	);
}

describe("draft sync", () => {
	it("says when open tabs cannot be loaded, and still lets the user work", async () => {
		mockFetch({
			"GET /api/v1/client/drafts": {
				status: 500,
				body: { error: { code: "INTERNAL", message: "Server is down." } },
			},
		});
		renderWorkbench();
		expect(
			await screen.findByText("Couldn't load your open tabs: Server is down."),
		).toBeInTheDocument();
		byDataId("editor-empty-new").click();
		expect(
			await screen.findByRole("textbox", { name: "URL" }),
		).toBeInTheDocument();
	});

	it("says at once when the server refuses a draft", async () => {
		const { calls } = mockFetch(NO_DRAFTS);
		renderWorkbench({ saveDelayMs: 0 });
		await screen.findByText("Drafts saved to your account");
		byDataId("tabbar-new").click();
		expect(
			await screen.findByText("Couldn't save the draft: no mock"),
		).toBeInTheDocument();
		// 404 is final: no second try, even after the retry delays.
		await new Promise((resolve) => setTimeout(resolve, 30));
		const paths = saves(calls).map((call) => call.path);
		expect(paths.length).toBeGreaterThan(0);
		expect(new Set(paths).size).toBe(paths.length);
	});

	it("tries a failed save again and shows saving until it succeeds", async () => {
		let failures = 2;
		const puts: string[] = [];
		const json = (body: unknown, status = 200) =>
			new Response(JSON.stringify(body), {
				status,
				headers: { "Content-Type": "application/json" },
			});
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const path = new URL(String(input), window.location.origin).pathname;
				const method = init?.method ?? "GET";
				if (method === "GET" && path === "/api/v1/client/drafts") {
					return json({ items: [] });
				}
				if (method === "PUT" && path.startsWith("/api/v1/client/drafts/")) {
					puts.push(path);
					if (failures === 0) return json({});
					failures -= 1;
					return json({ error: { code: "INTERNAL", message: "down" } }, 503);
				}
				return json({ error: { code: "NOT_FOUND", message: "no mock" } }, 404);
			}),
		);
		renderWorkbench({ saveDelayMs: 0, retryDelaysMs: [30, 30] });
		await screen.findByText("Drafts saved to your account");
		byDataId("tabbar-new").click();
		expect(await screen.findByText("Saving draft…")).toBeInTheDocument();
		expect(await screen.findByText("Draft saved")).toBeInTheDocument();
		expect(puts).toHaveLength(3);
		expect(screen.queryByText(/Couldn't save the draft/)).toBeNull();
	});

	it("sends the waiting draft with keepalive when the page is hidden", async () => {
		const { calls } = mockFetch(NO_DRAFTS);
		renderWorkbench({ saveDelayMs: 60_000 });
		await screen.findByText("Drafts saved to your account");
		byDataId("tabbar-new").click();
		await screen.findByRole("textbox", { name: "URL" });
		expect(saves(calls)).toHaveLength(0);
		act(() => {
			window.dispatchEvent(new Event("pagehide"));
		});
		await waitFor(() => expect(saves(calls)).toHaveLength(1));
		expect(saves(calls)[0]?.init).toMatchObject({ keepalive: true });
	});

	it("leaves a draft over the keepalive budget to its timer", async () => {
		const user = userEvent.setup();
		const big = createRequestDraft({
			url: "https://api.test/",
			body: {
				...createRequestDraft().body,
				type: "raw",
				raw: "x".repeat(70 * 1024),
			},
		});
		const { calls } = mockFetch({
			"GET /api/v1/client/drafts": {
				body: {
					items: [
						{ tabId: "big", order: 0, draft: big, updatedAt: "2026-10-10" },
					],
				},
			},
		});
		renderWorkbench({ saveDelayMs: 60_000 });
		// An edit makes the restored tab wait for its save.
		await user.type(await screen.findByRole("textbox", { name: "URL" }), "x");
		act(() => {
			window.dispatchEvent(new Event("pagehide"));
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(saves(calls)).toEqual([]);
	});
});
