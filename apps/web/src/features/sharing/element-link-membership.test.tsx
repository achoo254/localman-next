import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeUser } from "../../test/fixtures";
import type { MockRoute } from "../../test/mock-fetch";
import {
	PERSONAL,
	chooseWorkspace,
	savedWorkspace,
} from "../workspaces/workspaces-test-helpers";
import { ElementLinkPage } from "./element-link-page";
import { COLLECTION, renderSharing, summary } from "./sharing-test-helpers";

afterEach(() => vi.unstubAllGlobals());

function renderLink(routes: Record<string, MockRoute>) {
	return renderSharing(routes, {
		path: "/elements/:type/:id",
		at: "/elements/collection/c1",
		element: <ElementLinkPage />,
	});
}

describe("element links outside the caller's workspaces", () => {
	it("opens an element shared directly without switching workspace", async () => {
		chooseWorkspace(PERSONAL.id);
		const { router } = renderLink({
			"GET /api/v1/workspaces": { body: { items: [PERSONAL] } },
			[`GET ${COLLECTION}`]: summary({
				workspaceId: "w-other",
				role: "viewer",
			}),
		});
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
		expect(router.state.location.state).toEqual({
			openElement: { type: "collection", id: "c1" },
		});
		expect(savedWorkspace()).toBe(PERSONAL.id);
	});

	it("shows the error and retries when the session can't be read", async () => {
		chooseWorkspace(PERSONAL.id);
		let failing = true;
		const { calls } = renderLink({
			"GET /api/v1/users/me": () =>
				failing
					? {
							status: 500,
							body: { error: { code: "INTERNAL", message: "Down" } },
						}
					: { body: makeUser() },
			"GET /api/v1/workspaces": { body: { items: [PERSONAL] } },
			[`GET ${COLLECTION}`]: summary(),
		});
		expect(
			await screen.findByRole("heading", { name: "Couldn't open the link." }),
		).toBeInTheDocument();
		failing = false;
		const before = calls.filter((c) => c.path === "/api/v1/users/me").length;
		await userEvent.click(screen.getByRole("button", { name: "Try again" }));
		await waitFor(() =>
			expect(
				calls.filter((c) => c.path === "/api/v1/users/me").length,
			).toBeGreaterThan(before),
		);
	});
});
