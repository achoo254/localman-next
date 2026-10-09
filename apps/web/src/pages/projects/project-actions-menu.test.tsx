import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { makeProject } from "../../test/fixtures";
import { openMenu, renderPage } from "./projects-test-helpers";

const PROJECT = makeProject("p1", { name: "Demo" });

describe("project ⋮ menu by role", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("hides the owner's entries from a collaborator's ⋮ menu", async () => {
		renderPage({
			"GET /api/v1/projects": {
				body: {
					items: [makeProject("p1", { name: "Demo", role: "collaborator" })],
				},
			},
		});
		await openMenu("Demo");
		const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
		expect(items).toEqual(["Collaborators", "Duplicate"]);
	});

	it("gives the owner every entry", async () => {
		renderPage({ "GET /api/v1/projects": { body: { items: [PROJECT] } } });
		await openMenu("Demo");
		const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
		expect(items).toEqual([
			"Collaborators",
			"Magic link",
			"Duplicate",
			"Edit",
			"Delete",
		]);
	});
});
