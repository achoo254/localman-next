import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AppLayout } from "../../components/layout/app-layout";
import { ToastProvider } from "../../components/ui/toast";
import { TooltipProvider } from "../../components/ui/tooltip";
import { PrimitivesPage } from "./primitives-page";

function renderPage() {
	const router = createMemoryRouter([
		{
			path: "/",
			element: <AppLayout />,
			children: [{ index: true, element: <PrimitivesPage /> }],
		},
	]);
	return render(
		<TooltipProvider>
			<ToastProvider>
				<RouterProvider router={router} />
			</ToastProvider>
		</TooltipProvider>,
	);
}

describe("PrimitivesPage", () => {
	it("renders the shell and every page-level block with a data-id", () => {
		const { container } = renderPage();
		for (const id of [
			"public-header",
			"public-home",
			"theme-switch",
			"primitives",
			"primitives-buttons",
			"primitives-forms",
			"primitives-feedback",
			"primitives-loading",
			"primitives-overlays",
		]) {
			expect(container.querySelector(`[data-id="${id}"]`)).not.toBeNull();
		}
		expect(
			container.querySelector('[data-id="public-home"]'),
		).toHaveTextContent("Localman");
	});

	it("switches the theme attribute on <html>", async () => {
		const { container } = renderPage();
		// The shared theme switch is in the footer, as on the account app.
		const toggle = container.querySelector('[data-id="theme-switch"]');
		if (!(toggle instanceof HTMLElement)) throw new Error("no theme-switch");
		await userEvent.click(within(toggle).getByRole("button", { name: "Dark" }));
		expect(document.documentElement.dataset.theme).toBe("dark");
		await userEvent.click(
			within(toggle).getByRole("button", { name: "System" }),
		);
		expect(document.documentElement.dataset.theme).toBeUndefined();
	});

	it("opens the dropdown menu from the keyboard", async () => {
		renderPage();
		screen.getByRole("button", { name: "Project actions" }).focus();
		await userEvent.keyboard("{Enter}");
		expect(
			await screen.findByRole("menuitem", { name: "Delete project" }),
		).toHaveClass("text-error");
	});

	it("shows a toast", async () => {
		renderPage();
		await userEvent.click(screen.getByRole("button", { name: "Error toast" }));
		expect(
			await screen.findByText("Couldn't save. Try again."),
		).toBeInTheDocument();
	});

	it("shows the loading primitives: a spinning save, skeletons, a panel bar", async () => {
		const { container } = renderPage();
		const save = screen.getByRole("button", { name: "Save" });
		await userEvent.click(save);
		expect(save).toHaveAttribute("aria-busy", "true");
		expect(save).toHaveFocus();
		expect(
			container.querySelectorAll(
				'[data-id="primitives-loading-skeleton"] [data-skeleton]',
			).length,
		).toBeGreaterThan(0);
		await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
		expect(
			container.querySelector('[data-id="primitives-loading-panel"]'),
		).toHaveAttribute("aria-busy", "true");
	});
});
