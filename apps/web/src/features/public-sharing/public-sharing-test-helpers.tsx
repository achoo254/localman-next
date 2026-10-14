import {
	type PublicCollectionView,
	createRequestDraft,
} from "@localman/shared/api-client";
import type { ReactNode } from "react";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";

export const SHARING_FLAGS = {
	...NO_FEATURES,
	apiClient: true,
	workspaces: true,
	publicSharing: true,
};

const listOrders = createRequestDraft({
	name: "List orders",
	url: "{{baseUrl}}/orders?page=1",
	params: [{ id: "p1", key: "page", value: "1", enabled: true }],
	headers: [
		{ id: "h1", key: "X-Api-Key", value: "", enabled: true },
		{ id: "h2", key: "Accept", value: "application/json", enabled: true },
	],
	auth: { type: "bearer", token: "" },
});

/** A redacted collection as the API serves it: a folder, two requests. */
export function publicView(
	overrides: Partial<PublicCollectionView> = {},
): PublicCollectionView {
	return {
		name: "Orders API",
		description: "Orders of the shop",
		updatedAt: "2026-10-10T01:00:00.000Z",
		tree: {
			name: "Orders API",
			description: "Orders of the shop",
			auth: { type: "none" },
			variables: [
				{ key: "baseUrl", value: "https://api.example.com" },
				{ key: "apiKey", value: "", secret: true },
			],
			scripts: { pre: "", post: "" },
			tags: [],
			status: null,
			items: [
				{
					kind: "folder",
					id: "f1",
					name: "Orders",
					description: "",
					auth: { type: "inherit" },
					scripts: { pre: "", post: "" },
					items: [
						{
							kind: "request",
							id: "r1",
							name: "List orders",
							description: "Returns **every** order.",
							draft: listOrders,
							examples: [
								{
									id: "e1",
									name: "Two orders",
									request: listOrders,
									response: {
										status: 200,
										statusText: "OK",
										headers: [
											{
												id: "x1",
												key: "Content-Type",
												value: "application/json",
												enabled: true,
											},
										],
										body: "",
										bodyLanguage: "json",
									},
								},
							],
						},
					],
				},
				{
					kind: "request",
					id: "r2",
					name: "Health",
					description: "",
					draft: createRequestDraft({ name: "Health", url: "/health" }),
					examples: [],
				},
			],
		},
		...overrides,
	};
}

/** `element` at `path` under the given flags, with stand-in pages. */
export function renderPage(
	routes: Record<string, MockRoute>,
	{
		path,
		at,
		element,
		flags = SHARING_FLAGS,
	}: {
		path: string;
		at: string;
		element: ReactNode;
		flags?: typeof SHARING_FLAGS;
	},
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
			{ path: "/", element: <p>Home page</p> },
			{ path: "/api-client", element: <p>Workbench page</p> },
		],
		at,
	);
	return { ...api, ...view };
}

export function apiError(status: number, code: string) {
	return { status, body: { error: { code, message: code } } };
}

export const byId = (id: string) =>
	document.querySelector<HTMLElement>(`[data-id="${id}"]`);
export const allById = (id: string) => [
	...document.querySelectorAll<HTMLElement>(`[data-id="${id}"]`),
];
