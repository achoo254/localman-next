import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../test/axe";
import { findToast } from "../../test/toast";
import {
	BASE,
	block,
	callbackJson,
	callbacksJson,
	renderCallbacks,
} from "./callbacks-test-utils";

describe("callbacks editor: test, read only and limit", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("sends a test of the draft and shows the result", async () => {
		const { calls } = renderCallbacks(callbacksJson([callbackJson("cb1")]), {
			[`POST ${BASE}/test`]: {
				body: {
					target: "tunnel:3000/hooks",
					delivery: {
						at: "2026-10-10T02:00:00.000Z",
						ok: false,
						status: null,
						ms: 15,
						attempts: [
							{ at: "2026-10-10T02:00:00.000Z", error: "no_tunnel", ms: 5 },
							{ at: "2026-10-10T02:00:01.000Z", error: "no_tunnel", ms: 5 },
							{ at: "2026-10-10T02:00:05.000Z", error: "no_tunnel", ms: 5 },
						],
					},
					response: null,
				},
			},
		});
		const first = await waitFor(() => block(1));
		const user = userEvent.setup();
		const target = within(first).getByLabelText("Target");
		await user.clear(target);
		await user.type(target, "tunnel:3000/hooks");
		await user.click(within(first).getByRole("button", { name: "Send test" }));
		await findToast("The test to tunnel:3000/hooks failed after 3 attempts.");
		const post = calls.find((call) => call.method === "POST");
		expect(post?.body).toEqual({
			callback: {
				id: "cb1",
				on: "create",
				target: { kind: "tunnel", port: 3000, path: "/hooks" },
				bodyTemplate: callbackJson("cb1").bodyTemplate,
				headers: [],
				enabled: true,
			},
		});
		const result = first.querySelector(
			'[data-id="resource-form-callback-test-result"]',
		);
		expect(result).toHaveAttribute("data-state", "failed");
		expect(result).toHaveTextContent("Test to tunnel:3000/hooks:");
		expect(result).toHaveTextContent("Attempt 3/3");
		expect(result).toHaveTextContent("No tunnel mapping for this port");
	});

	it("says when other tests are still running", async () => {
		renderCallbacks(callbacksJson([callbackJson("cb1")]), {
			[`POST ${BASE}/test`]: {
				status: 429,
				body: { error: { code: "PROXY_BUSY", message: "Busy" } },
			},
		});
		const first = await waitFor(() => block(1));
		await userEvent
			.setup()
			.click(within(first).getByRole("button", { name: "Send test" }));
		expect(
			await within(first).findByText(
				"Other tests are still running. Wait for them, then try again.",
			),
		).toBeInTheDocument();
	});

	it("is read only for a collaborator", async () => {
		const { container } = renderCallbacks(
			callbacksJson([callbackJson("cb1")], { canManage: false }),
		);
		const first = await waitFor(() => block(1));
		expect(
			document.querySelector('[data-id="resource-form-callbacks-readonly"]'),
		).toHaveTextContent("Only the project owner can edit callbacks.");
		expect(within(first).getByLabelText("Target")).toBeDisabled();
		expect(within(first).getByRole("switch")).toBeDisabled();
		expect(within(first).getByLabelText("Event of callback 1")).toBeDisabled();
		for (const name of ["Send test", "Remove callback 1", "Add header"]) {
			expect(within(first).queryByRole("button", { name })).toBeNull();
		}
		expect(screen.queryByRole("button", { name: "Add callback" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Save callbacks" })).toBeNull();
		expect(within(first).getByText("Not sent yet.")).toBeInTheDocument();
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("stops at 10 callbacks", async () => {
		const ten = Array.from({ length: 10 }, (_item, index) =>
			callbackJson(`cb${index}`),
		);
		renderCallbacks(callbacksJson(ten));
		await waitFor(() => block(10));
		expect(screen.getByRole("button", { name: "Add callback" })).toBeDisabled();
		expect(
			screen.getByText("Up to 10 callbacks per resource."),
		).toBeInTheDocument();
		await userEvent
			.setup()
			.click(
				within(block(10)).getByRole("button", { name: "Remove callback 10" }),
			);
		expect(screen.getByRole("button", { name: "Add callback" })).toBeEnabled();
	});
});
