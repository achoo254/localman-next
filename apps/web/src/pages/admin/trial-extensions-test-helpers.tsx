import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { TrialExtensionsPage } from "./trial-extensions-page";

export const LIST = "/api/v1/admin/trial-extensions";

export function request(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		user: { sub: `sub-${id}`, username: `user${id}`, name: `Lan ${id}` },
		reason: "QA cycle runs until November",
		requestedAt: "2026-10-09T03:00:00.000Z",
		status: "pending",
		trialEndsAt: "2026-10-22T16:59:59.999Z",
		...overrides,
	};
}

export function renderAdmin(
	isOwner: boolean,
	routes: Record<string, MockRoute> = {},
) {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser({ isOwner }) },
		[`GET ${LIST}`]: ({ query }) => ({
			body: query.get("cursor")
				? { items: [request("r3")], nextCursor: null }
				: { items: [request("r1"), request("r2")], nextCursor: "c2" },
		}),
		...routes,
	});
	const view = renderRoutes(
		[{ path: "*", element: <TrialExtensionsPage /> }],
		"/admin/trial-extensions",
	);
	return { ...api, ...view };
}
