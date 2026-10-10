import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeProject } from "../../test/fixtures";
import { findToast } from "../../test/toast";
import { openMenu, renderPage } from "./projects-test-helpers";

async function createDemoShop() {
	await userEvent.click(
		await screen.findByRole("button", { name: "Create a new project" }),
	);
	await userEvent.type(screen.getByLabelText(/Project name/), "Demo shop");
	await userEvent.click(screen.getByRole("button", { name: "Create project" }));
}

describe("ProjectsPage after creating a project", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		// jsdom has no pointer capture; the toast's swipe handling asks for it.
		Object.defineProperty(Element.prototype, "hasPointerCapture", {
			configurable: true,
			value: () => false,
		});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		Reflect.deleteProperty(Element.prototype, "hasPointerCapture");
	});

	it("stays on the list and offers the new project's page in the toast", async () => {
		const { router } = renderPage({
			"GET /api/v1/projects": { body: { items: [] } },
			"POST /api/v1/projects": {
				status: 201,
				body: makeProject("p 9", { name: "Demo shop" }),
			},
		});
		await createDemoShop();
		const toast = await findToast("Created project Demo shop.");
		expect(router.state.location.pathname).toBe("/projects");
		expect(screen.getByRole("link", { name: /Demo shop/ })).toBeInTheDocument();
		const open = within(toast).getByRole("link", { name: "Open project" });
		expect(open).toHaveAttribute("href", "/projects/p%209");

		await userEvent.click(open);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/projects/p%209"),
		);
	});

	it("leaves a modified click to the browser (new tab)", async () => {
		const { router } = renderPage({
			"GET /api/v1/projects": { body: { items: [] } },
			"POST /api/v1/projects": {
				status: 201,
				body: makeProject("p9", { name: "Demo shop" }),
			},
		});
		await createDemoShop();
		const toast = await findToast("Created project Demo shop.");
		const open = within(toast).getByRole("link", { name: "Open project" });
		const user = userEvent.setup();
		// jsdom cannot open a tab; the app just must not route itself.
		open.addEventListener("click", (event) => event.preventDefault());
		await user.keyboard("{Control>}");
		await user.click(open);
		await user.keyboard("{/Control}");
		expect(router.state.location.pathname).toBe("/projects");
	});

	it("has no Open link after an edit", async () => {
		const project = makeProject("p1", { name: "Demo shop" });
		renderPage({
			"GET /api/v1/projects": { body: { items: [project] } },
			"PUT /api/v1/projects/p1": { body: { ...project, name: "Shop 2" } },
		});
		await openMenu("Demo shop");
		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Edit" }),
		);
		const name = screen.getByLabelText(/Project name/);
		await userEvent.clear(name);
		await userEvent.type(name, "Shop 2");
		await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
		const toast = await findToast("Updated project Shop 2.");
		expect(within(toast).queryByRole("link")).toBeNull();
	});
});
