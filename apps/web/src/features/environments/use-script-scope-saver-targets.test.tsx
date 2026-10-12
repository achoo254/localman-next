import type { ScriptScopeChanges } from "@localman/shared/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeaturesContext } from "../../config/features";
import { makeUser } from "../../test/fixtures";
import { mockFetch } from "../../test/mock-fetch";
import { createTestQueryClient } from "../../test/render-app";
import { resetCurrentUserCache } from "../auth/use-current-user";
import {
	PERSONAL,
	TEAM,
	chooseWorkspace,
} from "../workspaces/workspaces-test-helpers";
import { ENV_FLAGS } from "./environments-test-utils";
import { activeEnvironmentKey } from "./use-environments";
import { useScriptScopeSaver } from "./use-script-scope-saver";

const CHANGES: ScriptScopeChanges = {
	globals: [],
	collectionVariables: [],
	environment: [{ key: "token", value: "staging-token" }],
};

describe("useScriptScopeSaver", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		resetCurrentUserCache();
	});

	it("saves to the environment active when the send started", async () => {
		chooseWorkspace(TEAM.id);
		const { calls } = mockFetch({
			"GET /api/v1/users/me": { body: makeUser() },
			"GET /api/v1/workspaces": { body: { items: [PERSONAL, TEAM] } },
			"PATCH /api/v1/environments/env-staging/local-values": {
				body: { localValues: [{ key: "token", value: "staging-token" }] },
			},
		});
		const client = createTestQueryClient();
		const wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>
				<FeaturesContext value={ENV_FLAGS}>{children}</FeaturesContext>
			</QueryClientProvider>
		);
		const active = (environmentId: string) =>
			client.setQueryData(activeEnvironmentKey(TEAM.id), {
				workspaceId: TEAM.id,
				environmentId,
			});
		const { result } = renderHook(() => useScriptScopeSaver(), { wrapper });
		await waitFor(() => expect(result.current).toBeDefined());

		active("env-staging");
		const commit = result.current?.(null);
		// The person switches environments while the request is in flight.
		active("env-production");
		expect(await commit?.(CHANGES)).toEqual({ saved: true, dropped: [] });
		const patched = calls.filter((call) => call.method === "PATCH");
		expect(patched.map((call) => call.path)).toEqual([
			"/api/v1/environments/env-staging/local-values",
		]);
	});
});
