import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "../../components/layout/app-header";
import { NO_FEATURES } from "../../config/features";
import { makeUser } from "../../test/fixtures";
import { findToast } from "../../test/toast";
import { WorkspaceSwitcher } from "./workspace-switcher";
import {
	LIST,
	PERSONAL,
	TEAM,
	apiError,
	byId,
	chooseWorkspace,
	renderWithWorkspaces,
	savedWorkspace,
} from "./workspaces-test-helpers";

const NOTIFICATIONS = {
	"GET /api/v1/notifications": {
		body: { items: [], nextCursor: null, unreadCount: 0 },
	},
};

function renderHeader(at: string, flags = { ...NO_FEATURES, apiClient: true }) {
	return renderWithWorkspaces(NOTIFICATIONS, {
		path: at,
		element: <AppHeader user={makeUser()} />,
		at,
		flags: { ...flags, workspaces: flags.workspaces },
	});
}

async function openSwitcher() {
	const trigger = await screen.findByRole("button", { name: /^Workspace: / });
	trigger.focus();
	await userEvent.keyboard("{Enter}");
	return screen.findByRole("menu");
}

describe("workspace switcher", () => {
	beforeEach(() => chooseWorkspace(null));
	afterEach(() => vi.unstubAllGlobals());

	it("is not in the header while the workspaces flag is off", async () => {
		const { calls } = renderHeader("/api-client");
		await screen.findByRole("button", { name: "Notifications" });
		expect(byId("app-header-workspace")).toBeNull();
		expect(calls.some((call) => call.path === "/api/v1/workspaces")).toBe(
			false,
		);
	});

	it("shows on /api-client after the product nav, not on mock pages", async () => {
		const flags = { ...NO_FEATURES, apiClient: true, workspaces: true };
		const { unmount } = renderHeader("/projects", flags);
		await screen.findByRole("button", { name: "Notifications" });
		expect(byId("app-header-workspace")).toBeNull();
		unmount();

		renderHeader("/api-client", flags);
		const trigger = await screen.findByRole("button", {
			name: `Workspace: ${PERSONAL.name}`,
		});
		expect(trigger).toHaveAttribute("data-id", "app-header-workspace");
		expect(trigger).toHaveAttribute("aria-haspopup", "menu");
		const nav = screen.getByRole("navigation", { name: "Products" });
		expect(
			nav.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("switches workspace and remembers it in this browser", async () => {
		renderWithWorkspaces(
			{},
			{
				path: "/api-client",
				element: <WorkspaceSwitcher />,
				at: "/api-client",
			},
		);
		const menu = await openSwitcher();
		expect(within(menu).getByText("Workspace")).toBeInTheDocument();
		const personal = within(menu).getByRole("menuitemradio", {
			name: /Minh Anh's workspace/,
		});
		expect(personal).toHaveAttribute("aria-checked", "true");
		expect(personal).toHaveTextContent("Personal");
		const team = byId(`ws-menu-${TEAM.id}`);
		expect(team).toHaveTextContent("Team Payments");
		expect(team).toHaveTextContent("Team");
		expect(byId("ws-menu-create")).toHaveTextContent("Create workspace");
		expect(byId("ws-menu-settings")).toHaveTextContent("Workspace settings");

		await userEvent.click(team as HTMLElement);
		expect(
			await screen.findByRole("button", { name: "Workspace: Team Payments" }),
		).toBeInTheDocument();
		expect(savedWorkspace()).toBe(TEAM.id);
	});

	it("reads the personal workspace while the saved one is not in the list", async () => {
		chooseWorkspace("w-deleted");
		renderWithWorkspaces(
			{},
			{
				path: "/workspace/settings",
				element: <WorkspaceSwitcher />,
				at: "/workspace/settings",
			},
		);
		expect(
			await screen.findByRole("button", {
				name: `Workspace: ${PERSONAL.name}`,
			}),
		).toBeInTheDocument();
		// The fallback is read, never saved: a list fetched later may hold it.
		expect(savedWorkspace()).toBe("w-deleted");
	});

	it("creates a team workspace and makes it current", async () => {
		const created = { ...TEAM, id: "w-new", name: "Mobile", memberCount: 1 };
		const items = [PERSONAL];
		const { calls } = renderWithWorkspaces(
			{
				"POST /api/v1/workspaces": () => {
					items.push(created);
					return { status: 201, body: created };
				},
				[LIST]: () => ({ body: { items } }),
			},
			{
				path: "/api-client",
				element: <WorkspaceSwitcher />,
				at: "/api-client",
			},
		);
		await openSwitcher();
		await userEvent.click(byId("ws-menu-create") as HTMLElement);
		const dialog = await screen.findByRole("dialog", {
			name: "Create workspace",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create workspace" }),
		);
		expect(
			within(dialog).getByText("Enter a workspace name."),
		).toBeInTheDocument();
		await userEvent.type(
			within(dialog).getByLabelText(/Workspace name/),
			"Mobile",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create workspace" }),
		);
		expect(await findToast("Created workspace Mobile")).toBeInTheDocument();
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			name: "Mobile",
		});
		expect(
			await screen.findByRole("button", { name: "Workspace: Mobile" }),
		).toBeInTheDocument();
		expect(savedWorkspace()).toBe("w-new");
	});

	it("explains the team workspace limit and links to the plans", async () => {
		renderWithWorkspaces(
			{
				"POST /api/v1/workspaces": apiError(403, "PLAN_LIMIT_REACHED", {
					limit: "teamWorkspaces",
				}),
			},
			{
				path: "/api-client",
				element: <WorkspaceSwitcher />,
				at: "/api-client",
			},
		);
		await openSwitcher();
		await userEvent.click(byId("ws-menu-create") as HTMLElement);
		const dialog = await screen.findByRole("dialog");
		await userEvent.type(within(dialog).getByLabelText(/Workspace name/), "B");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create workspace" }),
		);
		const card = await waitFor(() => {
			const found = byId("modal-create-workspace-pro");
			if (!found) throw new Error("no limit card");
			return found;
		});
		expect(card).toHaveTextContent("Requires Pro");
		expect(card).toHaveTextContent("Your plan includes 1 team workspace.");
		expect(
			within(card).getByRole("link", { name: "View plans" }),
		).toHaveAttribute("href", "/pricing");
		expect(savedWorkspace()).toBeNull();
	});
});
