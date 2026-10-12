import type {
	CollectionDetail,
	CollectionSummary,
} from "@localman/shared/api-client";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect } from "vitest";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { ApiClientScreen } from "../../pages/api-client/api-client-screen";
import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { DEFAULT_CLIENT_SETTINGS } from "../api-client/routing/client-settings-api";
import { WorkbenchProvider } from "../api-client/workbench/workbench-context";
import { echoSender } from "../api-client/workbench/workbench-test-utils";
import { ElementLinkPage } from "../sharing/element-link-page";
import type { Workspace } from "../workspaces/workspaces-api";
import {
	FLAGS_ON,
	PERSONAL,
	TEAM,
	chooseWorkspace,
} from "../workspaces/workspaces-test-helpers";
import { folder, request } from "./collections-fixtures";
import { useCollectionSendContext } from "./use-send-context";

export { FLAGS_ON, PERSONAL, TEAM };
export const FLAGS_OFF = { ...NO_FEATURES, apiClient: true };

export { folder, request };

export const LIST_PATH = "/api/v1/workspaces/w-team/collections";

export function summary(
	id: string,
	overrides: Partial<CollectionSummary> = {},
): CollectionSummary {
	return {
		id,
		workspaceId: "w-team",
		name: `Collection ${id}`,
		role: "editor",
		favorite: false,
		tags: [],
		status: null,
		requestCount: 0,
		updatedAt: "2026-10-10T01:00:00.000Z",
		...overrides,
	};
}

export function detail(
	id: string,
	nodes: CollectionDetail["nodes"],
	overrides: Partial<CollectionDetail> = {},
): CollectionDetail {
	return {
		id,
		workspaceId: "w-team",
		name: `Collection ${id}`,
		role: "editor",
		description: "",
		auth: { type: "none" },
		scripts: { pre: "", post: "" },
		variables: [],
		tags: [],
		status: null,
		createdBy: "user-1",
		createdByName: "Minh Anh",
		updatedBy: "user-1",
		updatedByName: "Minh Anh",
		createdAt: "2026-10-01T01:00:00.000Z",
		updatedAt: "2026-10-10T01:00:00.000Z",
		mockProject: null,
		relatedEnvironment: null,
		nodes,
		...overrides,
	};
}

/** The provider as `ApiClientPage` sets it up, with the echo sender. */
function TestWorkbench() {
	const sendContext = useCollectionSendContext();
	return (
		<WorkbenchProvider
			sender={echoSender()}
			saveDelayMs={10}
			sendContext={sendContext}
		>
			<ApiClientScreen />
		</WorkbenchProvider>
	);
}

/** Endpoints the workbench reads on its own (drafts, history, settings). */
const WORKBENCH: Record<string, MockRoute> = {
	"GET /api/v1/client/drafts": { body: { items: [] } },
	"GET /api/v1/client/history": { body: { items: [], nextCursor: null } },
	"GET /api/v1/client/settings": { body: DEFAULT_CLIENT_SETTINGS },
};

/**
 * The API client page at `/api-client` (a stand-in at `/trash`, the
 * element link page) with the team workspace chosen; `role` is the
 * caller's role there, `storage` what this browser kept from an earlier
 * visit.
 */
export function renderWorkbenchPage(
	routes: Record<string, MockRoute>,
	{
		flags = FLAGS_ON,
		role = "admin",
		storage = {},
		at = "/api-client",
		workspace = TEAM.id,
	}: {
		flags?: typeof FLAGS_ON;
		role?: Workspace["role"];
		storage?: Record<string, string>;
		/** Where the router starts (an element link, say). */
		at?: string;
		/** The workspace this browser had chosen. */
		workspace?: string;
	} = {},
) {
	chooseWorkspace(workspace);
	for (const [key, value] of Object.entries(storage)) {
		window.localStorage.setItem(key, value);
	}
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		"GET /api/v1/workspaces": {
			body: { items: [PERSONAL, { ...TEAM, role }] },
		},
		...WORKBENCH,
		...routes,
	});
	const view = renderRoutes(
		[
			{
				path: "/api-client",
				element: (
					<FeaturesContext value={flags}>
						<TestWorkbench />
					</FeaturesContext>
				),
			},
			{ path: "/trash", element: <p>Trash page</p> },
			{
				path: "/elements/:type/:id",
				element: (
					<FeaturesContext value={flags}>
						<ElementLinkPage />
					</FeaturesContext>
				),
			},
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

/** A tree row by node or collection id. */
export const row = (id: string) =>
	document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);

export async function findRow(id: string): Promise<HTMLElement> {
	await waitFor(() => expect(row(id)).not.toBeNull());
	const element = row(id);
	if (!element) throw new Error(`No row ${id}`);
	return element;
}

export async function openMenu(id: string) {
	const user = userEvent.setup();
	const element = await findRow(id);
	await user.click(
		within(element).getByRole("button", { name: /More actions/ }),
	);
	return screen.findByRole("menu");
}

export const ORDERS = detail("c1", [
	folder("f1", null, "a0", "Users"),
	request("r1", "f1", "a0", "List users"),
	request("r2", null, "a1", "Health"),
]);
