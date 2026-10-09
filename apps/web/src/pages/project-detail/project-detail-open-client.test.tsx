import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { seriousViolations } from "../../test/axe";
import { makeProject, makeUser } from "../../test/fixtures";
import { mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { ProjectDetailPage } from "./project-detail-page";
import {
	PROJECT_ID,
	RESOURCES_PATH,
	findNode,
	sampleTree,
} from "./project-detail-test-helpers";

/** `/projects/p1` next to a stand-in `/api-client`, under `apiClient`. */
function renderPage(apiClient: boolean) {
	mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		[`GET /api/v1/projects/${PROJECT_ID}`]: {
			body: makeProject(PROJECT_ID, {
				secret: "abc123",
				mockBaseUrl: "https://abc123.mock.localman.test",
			}),
		},
		[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
	});
	const flags = { ...NO_FEATURES, apiClient };
	return renderRoutes(
		[
			{
				path: "/projects/:projectId",
				element: (
					<FeaturesContext value={flags}>
						<ProjectDetailPage />
					</FeaturesContext>
				),
			},
			{ path: "/api-client", element: <p>API client stand-in</p> },
		],
		`/projects/${PROJECT_ID}`,
	);
}

describe("project page: open in API Client", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("opens a resource from its node actions with ids in the navigation state", async () => {
		const { router } = renderPage(true);
		const posts = await findNode("posts");
		await userEvent.click(
			within(posts).getByRole("button", { name: "Open posts in API Client" }),
		);
		await screen.findByText("API client stand-in");
		expect(router.state.location.pathname).toBe("/api-client");
		expect(router.state.location.search).toBe("");
		expect(router.state.location.state).toEqual({
			openInApiClient: { projectId: PROJECT_ID, resourceId: "posts" },
		});
	});

	it("opens the whole project from the API endpoint card", async () => {
		const { router } = renderPage(true);
		await findNode("users");
		await userEvent.click(
			screen.getByRole("button", { name: "Open in API Client" }),
		);
		await screen.findByText("API client stand-in");
		expect(router.state.location.state).toEqual({
			openInApiClient: { projectId: PROJECT_ID },
		});
	});

	it("has no serious axe violations with the new actions", async () => {
		const { container } = renderPage(true);
		const users = await findNode("users");
		expect(
			users.querySelector('[data-id="resource-node-users-client"]'),
		).not.toBeNull();
		expect(await seriousViolations(container)).toEqual([]);
	});

	it("hides both actions while the apiClient flag is off", async () => {
		renderPage(false);
		const users = await findNode("users");
		expect(
			within(users).getByRole("button", { name: "Edit users" }),
		).toBeInTheDocument();
		expect(
			within(users).queryByRole("button", { name: "Open users in API Client" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Open in API Client" }),
		).not.toBeInTheDocument();
	});
});
