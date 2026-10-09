import type { ApiRequestDraft } from "@localman/shared/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { vi } from "vitest";
import { ToastProvider } from "../../../components/ui/toast";
import { TooltipProvider } from "../../../components/ui/tooltip";
import { ApiClientScreen } from "../../../pages/api-client/api-client-screen";
import { makeProject } from "../../../test/fixtures";
import { createTestQueryClient } from "../../../test/render-app";
import { WorkbenchProvider } from "../workbench/workbench-context";
import { echoSender, stubClientApi } from "../workbench/workbench-test-utils";

export const MOCK_BASE = "https://abc123.mock.localman.test/api/v1";

function endpoints(collectionUrl: string) {
	const itemUrl = `${collectionUrl}/{id}`;
	return [
		{ method: "GET", url: collectionUrl },
		{ method: "GET", url: itemUrl },
		{ method: "POST", url: collectionUrl },
		{ method: "PUT", url: itemUrl },
		{ method: "PATCH", url: itemUrl },
		{ method: "DELETE", url: itemUrl },
	];
}

/** `GET /projects/p1/mock-urls`: users and posts nested under users. */
export function mockUrlsJson() {
	const users = `${MOCK_BASE}/users`;
	const posts = `${MOCK_BASE}/users/{userId}/posts`;
	return {
		projectId: "p1",
		mockBaseUrl: MOCK_BASE,
		mcpUrl: `${MOCK_BASE}/mcp`,
		uiUrl: "https://localman.test/projects/p1",
		resources: [
			{
				id: "users",
				name: "users",
				parentId: null,
				depth: 0,
				collectionUrl: users,
				itemUrl: `${users}/{id}`,
				endpoints: endpoints(users),
			},
			{
				id: "posts",
				name: "posts",
				parentId: "users",
				depth: 1,
				collectionUrl: posts,
				itemUrl: `${posts}/{id}`,
				endpoints: endpoints(posts),
			},
		],
	};
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export interface OpenInRenderOptions {
	/** `location.state` of the `/api-client` entry. */
	state?: unknown;
	drafts?: { tabId: string; draft: ApiRequestDraft }[];
	/** Status of `GET /projects/p1/mock-urls` (200 by default). */
	mockUrlsStatus?: number;
}

/**
 * `/api-client` in a memory router (StrictMode, so effects run twice) with
 * the client API stubbed plus the projects list and p1's mock URLs.
 */
export function renderOpenIn({
	state = null,
	drafts = [],
	mockUrlsStatus = 200,
}: OpenInRenderOptions = {}) {
	stubClientApi(drafts);
	const clientFetch = globalThis.fetch;
	const mockUrlCalls: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const path = new URL(String(input), window.location.origin).pathname;
			if (path === "/api/v1/projects") {
				return json({ items: [makeProject("p1", { name: "Demo shop" })] });
			}
			if (path === "/api/v1/projects/p1/mock-urls") {
				mockUrlCalls.push(path);
				return mockUrlsStatus === 200
					? json(mockUrlsJson())
					: json(
							{ error: { code: "NOT_FOUND", message: "Project not found." } },
							mockUrlsStatus,
						);
			}
			return clientFetch(input, init);
		}),
	);
	const router = createMemoryRouter(
		[
			{
				path: "/api-client",
				element: (
					<WorkbenchProvider sender={echoSender()} saveDelayMs={10}>
						<ApiClientScreen />
					</WorkbenchProvider>
				),
			},
		],
		{ initialEntries: [{ pathname: "/api-client", state }] },
	);
	const view = render(
		<StrictMode>
			<QueryClientProvider client={createTestQueryClient()}>
				<TooltipProvider>
					<ToastProvider>
						<RouterProvider router={router} />
					</ToastProvider>
				</TooltipProvider>
			</QueryClientProvider>
		</StrictMode>,
	);
	return { ...view, router, mockUrlCalls };
}

/** Request tabs of the tab bar once it shows (not the editor's tabs). */
export async function findTabs(): Promise<HTMLElement[]> {
	const bar = await screen.findByRole("tablist", { name: "Open requests" });
	return within(bar).getAllByRole("tab");
}
