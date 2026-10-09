import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { ProjectsPage } from "./projects-page";

export const PLAN_LIMIT = {
	status: 403,
	body: {
		error: {
			code: "PLAN_LIMIT_REACHED",
			message: "Plan limit reached.",
			details: { limit: "projects", max: 3, used: 3 },
		},
	},
};

export function renderPage(routes: Record<string, MockRoute>) {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		...routes,
	});
	const view = renderRoutes(
		[{ path: "*", element: <ProjectsPage /> }],
		"/projects",
	);
	return { ...api, ...view };
}

export async function openMenu(name: string) {
	await userEvent.click(
		await screen.findByRole("button", { name: `Options for ${name}` }),
	);
}

/**
 * The plans dialog, found by `data-id` so these tests do not depend on the
 * subscription feature's copy.
 */
export function findPlansDialog(): Promise<HTMLElement> {
	return waitFor(() => {
		const dialog = document.querySelector<HTMLElement>(
			'[data-id="modal-subscription"]',
		);
		if (!dialog) throw new Error("the plans dialog is not open");
		return dialog;
	});
}

/** Child of the plans dialog by `data-id`. */
export function plansPart(dialog: HTMLElement, dataId: string): HTMLElement {
	const part = dialog.querySelector<HTMLElement>(`[data-id="${dataId}"]`);
	if (!part) throw new Error(`no ${dataId} in the plans dialog`);
	return part;
}
