import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { FeedbackInboxPage } from "./feedback-inbox-page";

export const LIST_PATH = "/api/v1/admin/contact-messages";

export function message(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		category: "bug",
		message: "Nút Lưu không chạy\nkhi có 20 field",
		name: "Lan",
		contact: "lan@example.com",
		contactKind: "email",
		source: "projects",
		userSub: "user-9",
		status: "new",
		createdAt: "2026-10-09T03:00:00.000Z",
		readAt: null,
		resolvedAt: null,
		...overrides,
	};
}

export function renderInbox(
	isOwner: boolean,
	routes: Record<string, MockRoute> = {},
) {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser({ isOwner }) },
		[`GET ${LIST_PATH}`]: {
			body: {
				items: [
					message("m1"),
					message("m2", {
						name: null,
						contact: null,
						contactKind: null,
						userSub: null,
						category: "feedback",
					}),
				],
				total: 2,
				page: 1,
				pageSize: 20,
			},
		},
		...routes,
	});
	renderRoutes(
		[{ path: "*", element: <FeedbackInboxPage /> }],
		"/admin/feedback",
	);
	return api;
}
