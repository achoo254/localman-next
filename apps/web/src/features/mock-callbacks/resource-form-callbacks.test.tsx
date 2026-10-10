import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import {
	RESOURCES_PATH,
	findNode,
	openNewResource,
	renderDetail,
	sampleTree,
} from "../../pages/project-detail/project-detail-test-helpers";
import { resetCurrentUserCache } from "../auth/use-current-user";
import { callbackJson, callbacksJson } from "./callbacks-test-utils";

const routes = {
	[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
	[`GET ${RESOURCES_PATH}/users/callbacks`]: {
		body: callbacksJson([callbackJson("cb1")]),
	},
};

async function openEditUsers(): Promise<HTMLElement> {
	await userEvent.click(
		within(await findNode("users")).getByRole("button", { name: "Edit users" }),
	);
	return screen.findByRole("dialog", { name: /users/ });
}

describe("Callbacks in the resource form", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows the callbacks of a saved resource with hybridMock", async () => {
		renderDetail(routes, undefined, {
			flags: { ...NO_FEATURES, hybridMock: true },
		});
		const dialog = await openEditUsers();
		const section = await within(dialog).findByRole("region", {
			name: "Callbacks",
		});
		expect(
			await within(section).findByDisplayValue("https://hooks.example.com/cb1"),
		).toBeInTheDocument();
	});

	it("has no callbacks when creating a resource", async () => {
		renderDetail(routes, undefined, {
			flags: { ...NO_FEATURES, hybridMock: true },
		});
		const dialog = await openNewResource();
		expect(
			dialog.querySelector('[data-id="resource-form-callbacks"]'),
		).toBeNull();
	});

	it("has no callbacks without hybridMock", async () => {
		const { calls } = renderDetail(routes, undefined, { flags: NO_FEATURES });
		const dialog = await openEditUsers();
		expect(
			dialog.querySelector('[data-id="resource-form-callbacks"]'),
		).toBeNull();
		expect(calls.some((call) => call.path.endsWith("/callbacks"))).toBe(false);
	});
});
