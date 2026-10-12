import { createRequestDraft } from "@localman/shared/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeaturesContext } from "../../config/features";
import { makeUser } from "../../test/fixtures";
import { mockFetch } from "../../test/mock-fetch";
import { createTestQueryClient } from "../../test/render-app";
import type { WorkbenchTab } from "../api-client/workbench/workbench-types";
import { resetCurrentUserCache } from "../auth/use-current-user";
import {
	PERSONAL,
	TEAM,
	chooseWorkspace,
} from "../workspaces/workspaces-test-helpers";
import { ENV_FLAGS } from "./environments-test-utils";
import { useVariableLayers } from "./use-variable-layers";

function tabWith(url: string, pre: string): WorkbenchTab {
	const draft = createRequestDraft({ url, scripts: { pre, post: "" } });
	return { id: "t1", draft } as unknown as WorkbenchTab;
}

async function renderLayers() {
	chooseWorkspace(TEAM.id);
	mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		"GET /api/v1/workspaces": { body: { items: [PERSONAL, TEAM] } },
		"GET /api/v1/workspaces/w-team/globals": { status: 500 },
		"GET /api/v1/workspaces/w-team/active-environment": { status: 500 },
	});
	const client = createTestQueryClient();
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>
			<FeaturesContext value={ENV_FLAGS}>{children}</FeaturesContext>
		</QueryClientProvider>
	);
	const { result } = renderHook(() => useVariableLayers(), { wrapper });
	await waitFor(() => expect(result.current).toBeDefined());
	const layersOf = result.current;
	if (!layersOf) throw new Error("no layers");
	return layersOf;
}

describe("useVariableLayers when the variables cannot be read", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		resetCurrentUserCache();
	});

	it("lets a request with scripts but no {{name}} go out", async () => {
		const layersOf = await renderLayers();
		const tab = tabWith("https://api.test/users", 'lm.test("ok", () => {});');
		await expect(layersOf(tab, null)).resolves.toBeUndefined();
	});

	it("stops a request that uses a variable", async () => {
		const layersOf = await renderLayers();
		const tab = tabWith("https://{{host}}/users", "");
		await expect(layersOf(tab, null)).rejects.toBeDefined();
	});
});
