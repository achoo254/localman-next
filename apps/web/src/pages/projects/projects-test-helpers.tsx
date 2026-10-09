import { screen } from "@testing-library/react";
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
			message: "Đã đạt giới hạn.",
			details: { limit: "projects", max: 3, used: 3 },
		},
	},
};

export function renderPage(routes: Record<string, MockRoute>) {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		...routes,
	});
	renderRoutes([{ path: "*", element: <ProjectsPage /> }], "/projects");
	return api;
}

export async function openMenu(name: string) {
	await userEvent.click(
		await screen.findByRole("button", { name: `Tuỳ chọn cho ${name}` }),
	);
}
