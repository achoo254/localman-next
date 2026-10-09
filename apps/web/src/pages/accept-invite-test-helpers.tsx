import type { InvitePreview } from "../features/collaborators/invites-api";
import { makeUser } from "../test/fixtures";
import { type MockRoute, mockFetch } from "../test/mock-fetch";
import { renderRoutes } from "../test/render-app";
import { AcceptInvitePage } from "./accept-invite-page";

export const TOKEN = "tok_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
export const PREVIEW = "POST /api/v1/invites/preview";
export const ACCEPT = "POST /api/v1/invites/accept";

export function preview(overrides: Partial<InvitePreview> = {}) {
	const body: InvitePreview = {
		kind: "invite",
		project: { id: "p1", name: "Demo shop" },
		inviter: { username: "hoa", name: "Hoà", picture: null },
		expiresAt: "2026-10-16T01:00:00.000Z",
		inviteeEmail: "t***@example.com",
		eligible: true,
		reason: null,
		...overrides,
	};
	return { body };
}

export const tokenError = (
	status: number,
	code: string,
	details?: unknown,
) => ({
	status,
	body: { error: { code, message: code, details } },
});

/** `/invite/TOKEN` signed in, with stand-ins for the pages it links to. */
export function renderInvite(api: Record<string, MockRoute>) {
	const calls = mockFetch({
		"GET /api/v1/users/me": {
			body: makeUser({ email: "minhanh@example.com" }),
		},
		...api,
	});
	const view = renderRoutes(
		[
			{ path: "/invite/:token", element: <AcceptInvitePage /> },
			{ path: "/projects/:projectId", element: <p>Trang project</p> },
			{ path: "/projects", element: <p>Danh sách</p> },
		],
		`/invite/${TOKEN}`,
	);
	return { ...calls, ...view };
}
