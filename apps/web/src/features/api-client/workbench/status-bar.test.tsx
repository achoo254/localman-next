import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	FLAGS_OFF,
	LIST_PATH,
	byId,
	renderWorkbenchPage,
} from "../../collections/collections-test-utils";
import { renderEnvironments } from "../../environments/environments-test-utils";

afterEach(() => vi.unstubAllGlobals());

const NO_COLLECTIONS = { [`GET ${LIST_PATH}`]: { body: { items: [] } } };

async function findById(id: string): Promise<HTMLElement> {
	await waitFor(() => expect(byId(id)).not.toBeNull());
	const element = byId(id);
	if (!element) throw new Error(`No ${id}`);
	return element;
}

describe("status bar entries", () => {
	it("opens the Trash, like the rail", async () => {
		renderWorkbenchPage(NO_COLLECTIONS);
		await userEvent.click(await findById("statusbar-trash"));
		expect(await screen.findByText("Trash page")).toBeVisible();
	});

	it("opens the workspace's globals as a tab when environments are on", async () => {
		renderEnvironments({});
		const globals = await findById("statusbar-globals");
		expect(globals).toHaveTextContent("Globals");
		await userEvent.click(globals);
		expect(
			await screen.findByRole("tab", { name: /Globals/ }),
		).toBeInTheDocument();
	});

	it("shows neither without workspaces, nor Globals without environments", async () => {
		renderWorkbenchPage(NO_COLLECTIONS, { flags: FLAGS_OFF });
		await findById("statusbar");
		expect(byId("statusbar-trash")).toBeNull();
		expect(byId("statusbar-globals")).toBeNull();
	});
});
