import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { ProInterestPage } from "./pro-interest-page";

export const STATS = {
	total: 12,
	new7d: 3,
	new30d: 9,
	bySource: [
		{ source: "landing", count: 5 },
		{ source: "plan_limit_projects", count: 7 },
	],
	byNeed: [{ need: "mock", count: 8 }],
};

export function item(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		email: `${id}.lan@example.com`,
		userSub: null,
		name: "Lan",
		needs: ["mock", "api_client"],
		teamSize: "2-5",
		priceHint: null,
		note: null,
		source: "landing",
		consentAt: "2026-10-08T03:00:00.000Z",
		createdAt: "2026-10-08T03:00:00.000Z",
		updatedAt: "2026-10-08T03:00:00.000Z",
		contactedAt: null,
		emailMatchesAccount: true,
		submissions: [
			{
				at: "2026-10-08T03:00:00.000Z",
				userSub: "user-9",
				name: "Lan",
				needs: ["mock", "api_client"],
				teamSize: "2-5",
				priceHint: "100-250",
				note: "Cần 30 project",
				source: "plan_limit_projects",
				emailMatchesAccount: true,
				applied: true,
			},
			{
				at: "2026-10-01T03:00:00.000Z",
				userSub: null,
				name: "Lan N.",
				needs: ["mock"],
				teamSize: "1",
				priceHint: null,
				note: null,
				source: "landing",
				emailMatchesAccount: false,
				applied: false,
			},
		],
		...overrides,
	};
}

export const LIST = {
	body: { items: [item("a1")], total: 1, page: 1, pageSize: 20 },
};

export function renderAdmin(
	isOwner: boolean,
	routes: Record<string, MockRoute>,
) {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser({ isOwner }) },
		"GET /api/v1/admin/pro-interest/stats": { body: STATS },
		"GET /api/v1/admin/pro-interest": LIST,
		...routes,
	});
	renderRoutes(
		[{ path: "*", element: <ProInterestPage /> }],
		"/admin/pro-interest",
	);
	return api;
}
