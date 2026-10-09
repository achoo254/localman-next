import { createRequestDraft } from "@localman/shared/api-client";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seriousViolations } from "../../../test/axe";
import { findToast } from "../../../test/toast";
import { byDataId } from "../workbench/workbench-test-utils";
import { MOCK_BASE, findTabs, renderOpenIn } from "./open-in-test-utils";

const RESOURCE_STATE = {
	openInApiClient: { projectId: "p1", resourceId: "posts" },
};
const PROJECT_STATE = { openInApiClient: { projectId: "p1" } };

describe("opening mock requests in the API client", () => {
	beforeEach(() => {
		// axe probes fonts through a canvas, which jsdom does not implement.
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("opens the resource from location.state once, then clears the state", async () => {
		const { router, mockUrlCalls } = renderOpenIn({ state: RESOURCE_STATE });
		const tab = await screen.findByRole("tab", { name: /List posts/ });
		expect(tab).toHaveAttribute("aria-selected", "true");
		expect(byDataId("request-method")).toHaveValue("GET");
		expect(router.state.location.state).toBeNull();
		expect(router.state.location.pathname).toBe("/api-client");
		// StrictMode ran the effect twice; the request still opened once.
		expect(await findTabs()).toHaveLength(1);
		expect(mockUrlCalls).toHaveLength(1);
	});

	it("uses {{variables}} for the parent id of a nested resource", async () => {
		renderOpenIn({ state: RESOURCE_STATE });
		await screen.findByRole("tab", { name: /List posts/ });
		expect(byDataId("request-url")).toHaveValue(
			`${MOCK_BASE}/users/{{userId}}/posts`,
		);
	});

	it("does not open anything without navigation state", async () => {
		const { mockUrlCalls } = renderOpenIn();
		expect(
			await screen.findByText("Drafts saved to your account"),
		).toBeVisible();
		expect(byDataId("editor-empty")).toBeInTheDocument();
		expect(mockUrlCalls).toHaveLength(0);
	});

	it("cuts the project at the tab cap and says so", async () => {
		const drafts = Array.from({ length: 48 }, (_, index) => ({
			tabId: `t${index}`,
			draft: createRequestDraft({ url: `https://a.test/${index}` }),
		}));
		renderOpenIn({ state: PROJECT_STATE, drafts });
		const toast = await findToast("Opened 2 of 12 requests");
		expect(toast).toHaveTextContent("Up to 50 tabs can stay open.");
		const tabs = await findTabs();
		expect(tabs).toHaveLength(50);
		expect(tabs[48]).toHaveAccessibleName(/List users/);
		expect(tabs[48]).toHaveAttribute("aria-selected", "true");
		expect(tabs[49]).toHaveAccessibleName(/Get one of users/);
	});

	it("reports a project it cannot load", async () => {
		renderOpenIn({ state: PROJECT_STATE, mockUrlsStatus: 404 });
		const toast = await findToast("Couldn't open the mock project");
		expect(toast).toHaveTextContent("Project not found.");
		expect(byDataId("editor-empty")).toBeInTheDocument();
	});

	it("reports a resource that is gone", async () => {
		renderOpenIn({
			state: { openInApiClient: { projectId: "p1", resourceId: "gone" } },
		});
		await findToast("This resource is no longer in the project.");
		expect(byDataId("editor-empty")).toBeInTheDocument();
	});

	it("opens every CRUD request of a project picked in 'From mock project'", async () => {
		renderOpenIn();
		const user = userEvent.setup();
		await screen.findByText("Drafts saved to your account");
		await user.click(byDataId("editor-empty-from-mock"));
		const dialog = await screen.findByRole("dialog", {
			name: "Open a mock project",
		});
		const radio = await within(dialog).findByRole("radio", {
			name: "Demo shop",
		});
		expect(radio).toBeChecked();
		expect(await seriousViolations(dialog)).toEqual([]);
		await user.click(
			within(dialog).getByRole("button", { name: "Open requests" }),
		);
		await waitFor(async () => expect(await findTabs()).toHaveLength(12));
		const tabs = await findTabs();
		expect(tabs.map((tab) => tab.textContent)).toEqual([
			"GETList users",
			"GETGet one of users",
			"POSTCreate in users",
			"PUTReplace in users",
			"PATCHUpdate in users",
			"DELDelete from users",
			"GETList posts",
			"GETGet one of posts",
			"POSTCreate in posts",
			"PUTReplace in posts",
			"PATCHUpdate in posts",
			"DELDelete from posts",
		]);
		expect(tabs[0]).toHaveAttribute("aria-selected", "true");
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});
