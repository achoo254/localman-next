import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import {
	RESOURCES_PATH,
	findNode,
	renderDetail,
	resourceJson,
	sampleTree,
} from "../../pages/project-detail/project-detail-test-helpers";
import { seriousViolations } from "../../test/axe";
import type { MockRoute } from "../../test/mock-fetch";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";
import { callbackJson, callbacksJson } from "./callbacks-test-utils";

const CALLBACKS = `${RESOURCES_PATH}/users/callbacks`;
const FLAGS = { flags: { ...NO_FEATURES, hybridMock: true } };

function render(putCallbacks: MockRoute) {
	return renderDetail(
		{
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`PUT ${RESOURCES_PATH}/users`]: { body: resourceJson("users") },
			[`GET ${CALLBACKS}`]: { body: callbacksJson([callbackJson("cb1")]) },
			[`PUT ${CALLBACKS}`]: putCallbacks,
		},
		undefined,
		FLAGS,
	);
}

async function openEditUsers(): Promise<HTMLElement> {
	await userEvent.click(
		within(await findNode("users")).getByRole("button", { name: "Edit users" }),
	);
	const dialog = await screen.findByRole("dialog", { name: /users/ });
	await within(dialog).findByDisplayValue("https://hooks.example.com/cb1");
	return dialog;
}

const writes = (calls: { method: string; path: string }[]) =>
	calls.filter((call) => call.method === "PUT").map((call) => call.path);

describe("Update saves the callbacks too", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("has one save button and saves the resource, then changed callbacks", async () => {
		const { calls } = render({
			body: callbacksJson([callbackJson("cb1", { enabled: false })]),
		});
		const dialog = await openEditUsers();
		expect(
			within(dialog).queryByRole("button", { name: /save callbacks/i }),
		).toBeNull();
		expect(
			within(dialog).getByRole("button", { name: "Send test" }),
		).toBeVisible();
		expect(await seriousViolations(dialog)).toEqual([]);

		const user = userEvent.setup();
		await user.click(
			within(dialog).getByRole("switch", { name: "Enable callback 1" }),
		);
		await user.click(within(dialog).getByRole("button", { name: "Update" }));
		expect(await findToast("Updated resource users.")).toBeInTheDocument();
		expect(writes(calls)).toEqual([`${RESOURCES_PATH}/users`, CALLBACKS]);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("does not send unchanged callbacks", async () => {
		const { calls } = render({ status: 500 });
		const dialog = await openEditUsers();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Update" }),
		);
		await findToast("Updated resource users.");
		expect(writes(calls)).toEqual([`${RESOURCES_PATH}/users`]);
	});

	it("writes nothing while a callback is invalid", async () => {
		const { calls } = render({ body: callbacksJson([]) });
		const dialog = await openEditUsers();
		const user = userEvent.setup();
		const target = within(dialog).getByLabelText("Target");
		await user.clear(target);
		await user.type(target, "http://hooks.example.com/x");
		await user.click(within(dialog).getByRole("button", { name: "Update" }));
		expect(
			await within(dialog).findByText(/^Only https is accepted/),
		).toBeInTheDocument();
		await waitFor(() => expect(target).toHaveFocus());
		expect(writes(calls)).toEqual([]);
	});

	it("says the resource was saved when the callbacks fail, and retries only them", async () => {
		let attempts = 0;
		const { calls } = render(() => {
			attempts += 1;
			return attempts === 1
				? {
						status: 500,
						body: { error: { code: "INTERNAL", message: "Boom" } },
					}
				: { body: callbacksJson([callbackJson("cb1", { enabled: false })]) };
		});
		const dialog = await openEditUsers();
		const user = userEvent.setup();
		await user.click(
			within(dialog).getByRole("switch", { name: "Enable callback 1" }),
		);
		const listReads = () =>
			calls.filter((c) => c.method === "GET" && c.path === RESOURCES_PATH)
				.length;
		const readsBefore = listReads();
		await user.click(within(dialog).getByRole("button", { name: "Update" }));

		const partial = await within(dialog).findByText(
			"Saved the resource, not the callbacks",
		);
		expect(partial.closest('[role="alert"]')).toHaveTextContent(
			"Fix the callbacks, then select Update again.",
		);
		expect(screen.getByRole("dialog")).toBe(dialog);
		// The tree picks up the saved resource even if the user cancels now.
		await waitFor(() => expect(listReads()).toBeGreaterThan(readsBefore));

		await user.click(within(dialog).getByRole("button", { name: "Update" }));
		expect(await findToast("Updated resource users.")).toBeInTheDocument();
		expect(writes(calls)).toEqual([
			`${RESOURCES_PATH}/users`,
			CALLBACKS,
			CALLBACKS,
		]);
	});
});
