import { waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { makeProject } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { InboxTab } from "./inbox-tab";

export const BASE = "/api/v1/projects/p1/inboxes";

/** An inbox as the API answers it; `overrides` replace whole fields. */
export function inboxJson(
	name: string,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		id: `id-${name}`,
		name,
		url: `https://secretp1.mock.localman.test/_inbox/${name}`,
		response: {
			status: 200,
			contentType: "application/json",
			body: '{"received":true}',
		},
		forward: null,
		lastForward: null,
		requestCount: 0,
		createdAt: "2026-10-10T01:00:00.000Z",
		...overrides,
	};
}

export function listJson(
	items: Record<string, unknown>[],
	overrides: Record<string, unknown> = {},
) {
	return { items, used: items.length, max: 2, canManage: true, ...overrides };
}

/** The Inbox tab of project p1 with its list and `routes` stubbed. */
export function renderInboxTab(
	list: Record<string, unknown>,
	routes: Record<string, MockRoute> = {},
) {
	const api = mockFetch({ [`GET ${BASE}`]: { body: list }, ...routes });
	const onShowLogs = vi.fn();
	const onPlanLimit = vi.fn();
	const view = renderRoutes(
		[
			{
				path: "/projects/:projectId",
				element: (
					<InboxTab
						project={makeProject("p1")}
						onShowLogs={onShowLogs}
						onPlanLimit={onPlanLimit}
					/>
				),
			},
		],
		"/projects/p1",
	);
	return { ...api, ...view, onShowLogs, onPlanLimit };
}

export const byId = (id: string) =>
	document.querySelector<HTMLElement>(`[data-id="${id}"]`);

/** The "Create inbox" button of the header (the empty state has one too). */
export function findCreate(): Promise<HTMLElement> {
	return waitFor(() => {
		const button = byId("inbox-new");
		if (!button) throw new Error("no Create inbox button yet");
		return button;
	});
}
