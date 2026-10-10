import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRecord } from "../../lib/json-guards";
import { seriousViolations } from "../../test/axe";
import { findToast } from "../../test/toast";
import {
	BASE,
	block,
	callbackJson,
	callbacksJson,
	renderCallbacks,
} from "./callbacks-test-utils";

const SECRET = callbackJson("cb1", {
	on: "update",
	headers: [
		{ name: "X-Hook-Secret", value: "[hidden]", hidden: true },
		{ name: "X-Team", value: "core" },
	],
	last: {
		at: "2026-10-10T02:00:00.000Z",
		ok: true,
		status: 200,
		ms: 84,
		attempts: [{ at: "2026-10-10T02:00:00.000Z", status: 200, ms: 84 }],
	},
});

/** The callbacks of the last PUT. */
function putCallbacks(calls: { method: string; body: unknown }[]): unknown {
	const put = calls.filter((call) => call.method === "PUT").at(-1);
	return isRecord(put?.body) ? put.body.callbacks : undefined;
}

describe("callbacks editor", () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows a callback with its last delivery and keeps a hidden header", async () => {
		const { calls, container } = renderCallbacks(callbacksJson([SECRET]), {
			[`PUT ${BASE}`]: { body: callbacksJson([SECRET]) },
		});
		const first = await waitFor(() => block(1));
		expect(within(first).getByLabelText("Event of callback 1")).toHaveValue(
			"update",
		);
		expect(within(first).getByLabelText("Target")).toHaveValue(
			"https://hooks.example.com/cb1",
		);
		const last = within(first)
			.getByText(/^Last sent/)
			.closest("[data-state]");
		expect(last).toHaveAttribute("data-state", "ok");
		expect(last).toHaveTextContent("84 ms after 1/3 attempts");
		const hidden = within(first).getByLabelText("Header value 1");
		expect(hidden).toHaveAttribute("type", "password");
		expect(hidden).toHaveAttribute("placeholder", "Hidden");
		expect(hidden).toHaveValue("");
		expect(await seriousViolations(container)).toEqual([]);

		const user = userEvent.setup();
		await user.click(
			within(first).getByRole("switch", { name: "Enable callback 1" }),
		);
		await user.click(screen.getByRole("button", { name: "Save callbacks" }));
		await findToast("Saved the callbacks.");
		expect(putCallbacks(calls)).toEqual([
			{
				id: "cb1",
				on: "update",
				target: { kind: "url", url: "https://hooks.example.com/cb1" },
				bodyTemplate: SECRET.bodyTemplate,
				headers: [
					{ name: "X-Hook-Secret", value: "[hidden]" },
					{ name: "X-Team", value: "core" },
				],
				enabled: false,
			},
		]);
	});

	it("adds a tunnel callback with a header and saves it", async () => {
		const { calls } = renderCallbacks(callbacksJson([]), {
			[`PUT ${BASE}`]: (call) => ({
				body: callbacksJson(
					isRecord(call.body) && Array.isArray(call.body.callbacks)
						? call.body.callbacks.map((_item, index) =>
								callbackJson(`new${index}`, {
									target: { kind: "tunnel", port: 3000, path: "/hooks/users" },
								}),
							)
						: [],
				),
			}),
		});
		expect(await screen.findByText(/^No callbacks yet/)).toBeInTheDocument();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Add callback" }));
		const first = block(1);
		const target = within(first).getByLabelText("Target");
		await waitFor(() => expect(target).toHaveFocus());
		await user.type(target, "tunnel:3000/hooks/users");
		await user.selectOptions(
			within(first).getByLabelText("Event of callback 1"),
			"delete",
		);
		await user.click(within(first).getByRole("button", { name: "Add header" }));
		await user.type(within(first).getByLabelText("Header name 1"), "X-Env");
		await user.type(within(first).getByLabelText("Header value 1"), "dev");
		expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Save callbacks" }));
		await findToast("Saved the callbacks.");
		expect(putCallbacks(calls)).toEqual([
			{
				on: "delete",
				target: { kind: "tunnel", port: 3000, path: "/hooks/users" },
				bodyTemplate: callbacksJson([]).defaultBodyTemplate,
				headers: [{ name: "X-Env", value: "dev" }],
				enabled: true,
			},
		]);
		expect(screen.queryByText("Unsaved changes")).toBeNull();
	});

	it("marks an http target and a reserved header without sending", async () => {
		const { calls } = renderCallbacks(callbacksJson([callbackJson("cb1")]));
		const first = await waitFor(() => block(1));
		const user = userEvent.setup();
		const target = within(first).getByLabelText("Target");
		await user.clear(target);
		await user.type(target, "http://hooks.example.com/x");
		await user.click(within(first).getByRole("button", { name: "Add header" }));
		await user.type(within(first).getByLabelText("Header name 1"), "Host");
		await user.click(screen.getByRole("button", { name: "Save callbacks" }));
		expect(
			await within(first).findByText(
				"Only https is accepted. To reach your machine, use tunnel:<port><path>.",
			),
		).toBeInTheDocument();
		expect(target).toHaveAttribute("aria-invalid", "true");
		expect(
			within(first).getByText("Host is set by Localman. Use another header."),
		).toBeInTheDocument();
		expect(
			screen.getByText("A callback isn't valid. Check the marked fields."),
		).toBeInTheDocument();
		await waitFor(() => expect(target).toHaveFocus());
		expect(calls.some((call) => call.method === "PUT")).toBe(false);
		await user.type(target, "s");
		expect(target).not.toHaveAttribute("aria-invalid");
	});

	it("puts the API's target error on the right callback", async () => {
		renderCallbacks(callbacksJson([callbackJson("a"), callbackJson("b")]), {
			[`PUT ${BASE}`]: {
				status: 400,
				body: {
					error: {
						code: "CALLBACK_URL_BLOCKED",
						message: "Blocked",
						details: [
							{
								path: "callbacks.1.target.url",
								message: "This host is private.",
							},
						],
					},
				},
			},
		});
		await waitFor(() => block(2));
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Save callbacks" }));
		expect(
			await within(block(2)).findByText("This host is private."),
		).toBeInTheDocument();
		expect(within(block(1)).queryByText("This host is private.")).toBeNull();
		expect(within(block(2)).getByLabelText("Target")).toHaveAttribute(
			"aria-invalid",
			"true",
		);
	});
});
