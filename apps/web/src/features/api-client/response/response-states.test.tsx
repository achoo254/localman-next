import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { byId, done, renderPanel } from "./response-test-helpers";

describe("ResponsePanel states and tabs", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => vi.restoreAllMocks());

	it.each([
		[201, "success"],
		[302, "info"],
		[404, "warning"],
		[500, "danger"],
	] as const)("tones status %i as %s", (status, tone) => {
		renderPanel(done({ status, statusText: "" }));
		expect(byId("response-status")).toHaveAttribute("data-tone", tone);
		expect(byId("response-status")).toHaveTextContent(String(status));
	});

	it("lists Set-Cookie as cookies, or explains why a direct send has none", async () => {
		const { unmount } = renderPanel(
			done({
				headers: [
					{ name: "Set-Cookie", value: "sid=abc; Path=/; HttpOnly" },
					{ name: "Set-Cookie", value: "theme=dark; Max-Age=60; Secure" },
				],
			}),
		);
		await userEvent.click(screen.getByRole("tab", { name: "Cookies 2" }));
		const rows = within(screen.getByRole("table")).getAllByRole("row");
		expect(rows[1]).toHaveTextContent("sidabcapi.example.com/SessionYesNo");
		expect(rows[2]).toHaveTextContent("themedark");
		expect(rows[2]).toHaveTextContent("60 s");
		unmount();

		renderPanel(done({ headers: [] }, "direct"));
		await userEvent.click(screen.getByRole("tab", { name: "Cookies 0" }));
		expect(byId("response-cookies-direct")).toHaveTextContent(
			"doesn't let the page read Set-Cookie",
		);
	});

	it("shows the post-response tests with their result", async () => {
		renderPanel(
			done({}, "proxy", {
				tests: [
					{ name: "status is 200", passed: true, error: null },
					{ name: "has email", passed: false, error: "expected undefined" },
				],
				logs: [{ level: "log", message: "checked" }],
				logsTruncated: false,
				error: null,
			}),
		);
		await userEvent.click(screen.getByRole("tab", { name: "Tests 2" }));
		expect(byId("response-tests-summary")).toHaveTextContent(
			"1 of 2 tests passed",
		);
		const tests = document.querySelectorAll('[data-id="response-test"]');
		expect(tests[1]).toHaveAttribute("data-passed", "false");
		expect(tests[1]).toHaveTextContent("expected undefined");
		expect(screen.getByText("checked")).toBeInTheDocument();
	});

	it("cancels a send in flight", async () => {
		const onCancel = vi.fn();
		renderPanel({ kind: "sending" }, onCancel);
		// The spinner waits 150 ms so quick answers never flash it.
		expect(screen.queryByRole("status")).toBeNull();
		expect(await screen.findByRole("status")).toHaveTextContent("Sending…");
		await userEvent.click(
			screen.getByRole("button", { name: "Cancel request" }),
		);
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("explains a blocked target with its code", () => {
		renderPanel({
			kind: "failed",
			failure: {
				code: "PROXY_TARGET_BLOCKED",
				message: "blocked",
				status: 403,
				details: { reason: "address" },
				preScript: null,
			},
		});
		expect(screen.getByRole("alert")).toHaveTextContent(
			"The proxy doesn't reach this address",
		);
		expect(screen.getByRole("alert")).toHaveTextContent("Tunelo tunnel");
		expect(byId("response-error-code")).toHaveTextContent(
			"Code: PROXY_TARGET_BLOCKED",
		);
	});

	it("words a timeout with the request's own limit", () => {
		renderPanel({
			kind: "failed",
			failure: {
				code: "PROXY_TIMEOUT",
				message: "timeout",
				status: 504,
				details: { timeoutMs: 5000 },
				preScript: null,
			},
		});
		expect(screen.getByRole("alert")).toHaveTextContent("within 5 s");
	});

	it("keeps the workbench's message and the pre-request console for other codes", () => {
		renderPanel({
			kind: "failed",
			failure: {
				code: "SCRIPT_ERROR",
				message: "The pre-request script failed at line 2.",
				status: null,
				preScript: {
					tests: [],
					logs: [{ level: "error", message: "token missing" }],
					logsTruncated: false,
					error: { code: "SCRIPT_ERROR", message: "boom", line: 2 },
				},
			},
		});
		expect(screen.getByRole("alert")).toHaveTextContent(
			"The pre-request script failed at line 2.",
		);
		expect(byId("response-script-console")).toHaveTextContent("token missing");
		expect(screen.queryByText(/post-response/)).not.toBeInTheDocument();
	});

	it("words a sandbox stop of the post-response script in the language on screen", async () => {
		renderPanel(
			done({}, "proxy", {
				tests: [],
				logs: [],
				logsTruncated: false,
				error: {
					code: "SCRIPT_TIMEOUT",
					message: "Script worker stopped (SCRIPT_TIMEOUT)",
				},
			}),
		);
		await userEvent.click(screen.getByRole("tab", { name: /Tests/ }));
		expect(byId("response-tests-error")).toHaveTextContent(
			"The post-response script stopped: The script ran for too long and was stopped.",
		);
		expect(byId("response-tests-error")).not.toHaveTextContent("worker");
	});
});
