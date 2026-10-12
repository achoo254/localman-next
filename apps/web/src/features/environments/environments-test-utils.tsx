import type {
	EnvironmentDetail,
	GlobalsDetail,
	VariableView,
} from "@localman/shared/api-client";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { ApiClientScreen } from "../../pages/api-client/api-client-screen";
import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { DEFAULT_CLIENT_SETTINGS } from "../api-client/routing/client-settings-api";
import { WorkbenchProvider } from "../api-client/workbench/workbench-context";
import { echoSender } from "../api-client/workbench/workbench-test-utils";
import { useCollectionSendContext } from "../collections/use-send-context";
import type { Workspace } from "../workspaces/workspaces-api";
import {
	PERSONAL,
	TEAM,
	chooseWorkspace,
} from "../workspaces/workspaces-test-helpers";
import { useVariableLayers } from "./use-variable-layers";

export const ENV_FLAGS = {
	...NO_FEATURES,
	apiClient: true,
	workspaces: true,
	environments: true,
};
export const ENV_PATH = "/api/v1/environments/e1";
export const LIST = "/api/v1/workspaces/w-team/environments";
export const ACTIVE = "/api/v1/workspaces/w-team/active-environment";
export const GLOBALS = "/api/v1/workspaces/w-team/globals";

export const variable = (
	key: string,
	sharedValue: string | null,
	extra: Partial<VariableView> = {},
): VariableView => ({
	id: `v-${key}`,
	key,
	type: "default",
	enabled: true,
	description: "",
	sharedValue,
	sharedHidden: false,
	...extra,
});

export function environment(
	overrides: Partial<EnvironmentDetail> = {},
): EnvironmentDetail {
	return {
		id: "e1",
		workspaceId: "w-team",
		name: "Staging",
		color: "green",
		role: "editor",
		variableCount: 2,
		updatedAt: "2026-10-12T01:00:00.000Z",
		variables: [
			variable("baseUrl", "https://staging.test"),
			variable("token", "s3cret", { type: "secret" }),
		],
		localValues: [],
		createdBy: "user-1",
		createdByName: "Ada Lovelace",
		createdAt: "2026-10-12T01:00:00.000Z",
		...overrides,
	};
}

/** The list entry of `environment(overrides)`. */
export function summary(overrides: Partial<EnvironmentDetail> = {}) {
	const {
		variables,
		localValues,
		createdBy,
		createdByName,
		createdAt,
		...rest
	} = environment(overrides);
	return rest;
}

/** Opens Staging from the Environments sidebar; resolves to its table. */
export async function openStaging(user = userEvent.setup()) {
	await user.click(await screen.findByRole("button", { name: "Envs" }));
	await user.click(
		await screen.findByRole("button", { name: /^Staging( \(active\))?$/ }),
	);
	return screen.findByRole("table", { name: "Variables of Staging" });
}

export const EMPTY_GLOBALS: GlobalsDetail = {
	workspaceId: "w-team",
	role: "editor",
	variables: [],
	localValues: [],
	updatedAt: null,
};

function TestWorkbench() {
	const sendContext = useCollectionSendContext();
	const variablesOf = useVariableLayers();
	return (
		<WorkbenchProvider
			sender={echoSender()}
			saveDelayMs={10}
			sendContext={sendContext}
			variablesOf={variablesOf}
		>
			<ApiClientScreen />
		</WorkbenchProvider>
	);
}

/** `/api-client` with the team workspace chosen and environments on. */
export function renderEnvironments(
	routes: Record<string, MockRoute>,
	{ role = "admin" }: { role?: Workspace["role"] } = {},
) {
	chooseWorkspace(TEAM.id);
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		"GET /api/v1/workspaces": {
			body: { items: [PERSONAL, { ...TEAM, role }] },
		},
		"GET /api/v1/client/drafts": { body: { items: [] } },
		"GET /api/v1/client/history": { body: { items: [], nextCursor: null } },
		"GET /api/v1/client/settings": { body: DEFAULT_CLIENT_SETTINGS },
		"GET /api/v1/workspaces/w-team/collections": { body: { items: [] } },
		[`GET ${ACTIVE}`]: { body: { workspaceId: "w-team", environmentId: null } },
		[`GET ${GLOBALS}`]: { body: EMPTY_GLOBALS },
		...routes,
	});
	const view = renderRoutes(
		[
			{
				path: "/api-client",
				element: (
					<FeaturesContext value={ENV_FLAGS}>
						<TestWorkbench />
					</FeaturesContext>
				),
			},
		],
		"/api-client",
	);
	return { ...api, ...view };
}

export const byId = (id: string) =>
	document.querySelector<HTMLElement>(`[data-id="${id}"]`);
