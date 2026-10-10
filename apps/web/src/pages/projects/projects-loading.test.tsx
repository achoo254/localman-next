import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { seriousViolations } from "../../test/axe";
import { makeProject } from "../../test/fixtures";
import type { MockReply } from "../../test/mock-fetch";
import { renderPage } from "./projects-test-helpers";
import { projectsKey } from "./use-projects";

/** A route whose answer waits until the test releases it. */
function held() {
	const pending: Array<(reply: MockReply) => void> = [];
	return {
		route: () =>
			new Promise<MockReply>((resolve) => {
				pending.push(resolve);
			}),
		release: (reply: MockReply) => {
			for (const resolve of pending.splice(0)) resolve(reply);
		},
	};
}

const LIST = { body: { items: [makeProject("p1", { name: "Shop" })] } };
const panelBar = () =>
	document.querySelector(
		'[data-id="projects-panel"] [data-id="panel-progress"]',
	);

describe("ProjectsPage loading states", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("shows a row-shaped skeleton on a slow first load, announced once", async () => {
		const list = held();
		const { container } = renderPage({ "GET /api/v1/projects": list.route });
		const region = await waitFor(() => {
			const found = document.querySelector('[data-id="projects-loading"]');
			if (!found) throw new Error("no skeleton yet");
			return found;
		});
		expect(region).toHaveAttribute("aria-busy", "true");
		// The status text is filled once the live region is in the DOM.
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("Loading projects…"),
		);
		expect(screen.getAllByRole("status")).toHaveLength(1);
		expect(await seriousViolations(container)).toEqual([]);
		await act(async () => list.release(LIST));
		expect(await screen.findByText("Shop")).toBeInTheDocument();
		expect(document.querySelector('[data-id="projects-loading"]')).toBeNull();
	});

	it("keeps the list and runs the panel bar during a slow refetch", async () => {
		let slow: ReturnType<typeof held> | null = null;
		const { queryClient } = renderPage({
			"GET /api/v1/projects": () => (slow ? slow.route() : LIST),
		});
		expect(await screen.findByText("Shop")).toBeInTheDocument();
		const refetch = held();
		slow = refetch;
		act(() => void queryClient.invalidateQueries({ queryKey: projectsKey }));
		await waitFor(() => expect(panelBar()).not.toBeNull());
		expect(screen.getByText("Shop")).toBeInTheDocument();
		expect(
			document.querySelector('[data-id="projects-panel"]'),
		).toHaveAttribute("aria-busy", "true");
		await act(async () => refetch.release(LIST));
		await waitFor(() => expect(panelBar()).toBeNull());
	});

	it("spins the create button until the project is saved", async () => {
		const create = held();
		renderPage({
			"GET /api/v1/projects": { body: { items: [] } },
			"POST /api/v1/projects": create.route,
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Create a new project" }),
		);
		await userEvent.type(screen.getByLabelText(/Project name/), "Demo shop");
		const submit = screen.getByRole("button", { name: "Create project" });
		await userEvent.click(submit);
		await waitFor(() => expect(submit).toHaveAttribute("aria-busy", "true"));
		expect(submit).toHaveAttribute("aria-disabled", "true");
		await act(async () =>
			create.release({
				status: 201,
				body: makeProject("p9", { name: "Demo shop" }),
			}),
		);
		expect(await screen.findByText("Demo shop")).toBeInTheDocument();
	});
});
