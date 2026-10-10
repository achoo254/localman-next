import type { ReactNode } from "react";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import type { AccessRequest } from "./access-requests-api";
import { ShareDialog, type ShareDialogProps } from "./share-dialog";
import type {
	ElementAccess,
	ElementShare,
	ElementSummary,
} from "./sharing-api";

export const FLAGS_ON = { ...NO_FEATURES, apiClient: true, workspaces: true };
export const COLLECTION = "/api/v1/elements/collection/c1";

export function summary(overrides: Partial<ElementSummary> = {}) {
	const body: ElementSummary = {
		type: "collection",
		id: "c1",
		name: "Orders API",
		workspaceId: "w-team",
		role: "editor",
		...overrides,
	};
	return { body };
}

export function share(
	username: string,
	overrides: Partial<ElementShare> = {},
): ElementShare {
	return {
		id: `s-${username}`,
		userId: `sub-${username}`,
		email: null,
		username,
		name: username.charAt(0).toUpperCase() + username.slice(1),
		picture: null,
		role: "viewer",
		...overrides,
	};
}

export function accessView(
	shares: ElementShare[],
	workspaceType: "team" | "personal" = "team",
): ElementAccess {
	return {
		workspace: {
			id: "w-team",
			name: workspaceType === "team" ? "Team Payments" : "Minh Anh",
			type: workspaceType,
			memberCount: 3,
		},
		shares,
	};
}

export function accessRequest(
	overrides: Partial<AccessRequest> = {},
): AccessRequest {
	return {
		id: "r1",
		element: { type: "collection", id: "c1", name: "Orders API" },
		requester: { username: "lan", name: "Lan", picture: null },
		role: "viewer",
		message: "Need it for the release",
		status: "pending",
		createdAt: "2026-10-10T01:00:00.000Z",
		...overrides,
	};
}

export function apiError(status: number, code: string) {
	return { status, body: { error: { code, message: code } } };
}

/** `element` at `path` under the given flags, with stand-in pages. */
export function renderSharing(
	routes: Record<string, MockRoute>,
	{
		path,
		at,
		element,
		flags = FLAGS_ON,
	}: { path: string; at: string; element: ReactNode; flags?: typeof FLAGS_ON },
) {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		...routes,
	});
	const view = renderRoutes(
		[
			{
				path,
				element: <FeaturesContext value={flags}>{element}</FeaturesContext>,
			},
			{ path: "/api-client", element: <p>Workbench page</p> },
		],
		at,
	);
	return { ...api, ...view };
}

export const byId = (id: string) =>
	document.querySelector<HTMLElement>(`[data-id="${id}"]`);
export const allById = (id: string) => [
	...document.querySelectorAll<HTMLElement>(`[data-id="${id}"]`),
];

/** Shares of the collection c1 in the dialog tests. */
export const LAN = share("lan");
export const EMAIL_ONLY = share("x", {
	userId: null,
	username: null,
	name: null,
	email: "new@example.com",
	role: "editor",
});

export function renderDialog(
	routes: Record<string, MockRoute>,
	props: Partial<ShareDialogProps> = {},
	flags = FLAGS_ON,
) {
	return renderSharing(
		{
			[`GET ${COLLECTION}`]: summary(),
			[`GET ${COLLECTION}/access`]: { body: accessView([LAN, EMAIL_ONLY]) },
			...routes,
		},
		{
			path: "/api-client/x",
			at: "/api-client/x",
			flags,
			element: (
				<ShareDialog
					elementType="collection"
					elementId="c1"
					elementName="Orders API"
					open
					onOpenChange={() => {}}
					{...props}
				/>
			),
		},
	);
}
