import {
	type CollectionDetail,
	type CollectionFolderNode,
	type CollectionRequestNode,
	type CollectionSummary,
	createRequestDraft,
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
import type { Workspace } from "../workspaces/workspaces-api";
import {
	FLAGS_ON,
	PERSONAL,
	TEAM,
	chooseWorkspace,
} from "../workspaces/workspaces-test-helpers";
import { useCollectionSendContext } from "./use-send-context";

export { FLAGS_ON, PERSONAL, TEAM };
export const FLAGS_OFF = { ...NO_FEATURES, apiClient: true };

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
		requestCount: 0,
		updatedAt: "2026-10-10T01:00:00.000Z",
		...overrides,
	};
}

export function folder(
	id: string,
	parentId: string | null,
	order: string,
	name = `Folder ${id}`,
): CollectionFolderNode {
	return {
		kind: "folder",
		id,
		parentId,
		order,
		name,
		description: "",
		auth: { type: "inherit" },
		scripts: { pre: "", post: "" },
	};
}

export function request(
	id: string,
	parentId: string | null,
	order: string,
	name = `Request ${id}`,
): CollectionRequestNode {
	return {
		kind: "request",
		id,
		parentId,
		order,
		name,
		description: "",
		draft: createRequestDraft({ name, url: `https://api.test/${id}` }),
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
		createdBy: "user-1",
		createdAt: "2026-10-01T01:00:00.000Z",
		updatedAt: "2026-10-10T01:00:00.000Z",
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
 * The API client page at `/api-client` (a stand-in at `/trash`) with the
 * team workspace chosen; `role` is the caller's role there.
 */
export function renderWorkbenchPage(
	routes: Record<string, MockRoute>,
	{
		flags = FLAGS_ON,
		role = "admin",
	}: { flags?: typeof FLAGS_ON; role?: Workspace["role"] } = {},
) {
	chooseWorkspace(TEAM.id);
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
		],
		"/api-client",
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
