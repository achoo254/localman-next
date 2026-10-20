import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../../test/mock-fetch";
import { DeleteAccountModal } from "./delete-account-modal";

const navigation = vi.hoisted(() => ({ reloadAt: vi.fn() }));
vi.mock("../../platform/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../platform/navigation")>()),
	reloadAt: navigation.reloadAt,
}));

const summary = (overrides: Record<string, unknown> = {}) => ({
	dryRun: true,
	deleted: false,
	ownedProjects: 2,
	sharedProjects: 1,
	workspacesDeleted: 1,
	workspacesLeft: 1,
	collectionsDeleted: 3,
	blockedWorkspaces: [],
	...overrides,
});

function renderModal() {
	render(
		<MemoryRouter>
			<DeleteAccountModal
				open
				onOpenChange={() => undefined}
				username="minhanh"
			/>
		</MemoryRouter>,
	);
}

const confirmButton = () =>
	screen.getByRole("button", { name: "Delete account" });

describe("DeleteAccountModal", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		navigation.reloadAt.mockReset();
		document.cookie = "lm_sso_hint=; Max-Age=0; Path=/";
	});

	it("shows the dry run, then deletes once the username is typed back", async () => {
		document.cookie = "lm_sso_hint=1; Path=/";
		const { calls } = mockFetch({
			"DELETE /api/v1/users/me": (call) =>
				call.query.get("dryRun") === "true"
					? { body: summary() }
					: { body: summary({ dryRun: false, deleted: true }) },
		});
		renderModal();
		expect(
			await screen.findByText("2 mock projects you own, with their data"),
		).toBeInTheDocument();
		expect(
			screen.getByText("1 of them is shared: its members lose access too"),
		).toBeInTheDocument();
		expect(
			screen.getByText("3 collections in them, with their requests"),
		).toBeInTheDocument();
		expect(confirmButton()).toBeDisabled();

		const user = userEvent.setup();
		await user.type(screen.getByRole("textbox"), "minhanh");
		expect(confirmButton()).toBeEnabled();
		await user.click(confirmButton());

		await waitFor(() =>
			expect(navigation.reloadAt).toHaveBeenCalledWith(
				"/account/delete?deleted=1",
			),
		);
		const deletion = calls.find(
			(call) => call.method === "DELETE" && !call.query.has("dryRun"),
		);
		expect(deletion?.body).toEqual({ confirm: "minhanh" });
		// No silent sign-in would recreate the account.
		expect(document.cookie).not.toContain("lm_sso_hint=1");
	});

	it("lists the workspaces that block the deletion and keeps it off", async () => {
		mockFetch({
			"DELETE /api/v1/users/me": {
				body: summary({ blockedWorkspaces: [{ id: "w1", name: "Payments" }] }),
			},
		});
		renderModal();
		expect(await screen.findByText("Payments")).toBeInTheDocument();
		expect(screen.queryByRole("textbox")).toBeNull();
		expect(confirmButton()).toBeDisabled();
	});

	it("shows the API's message when the deletion fails, and stays", async () => {
		mockFetch({
			"DELETE /api/v1/users/me": (call) =>
				call.query.get("dryRun") === "true"
					? { body: summary() }
					: {
							status: 409,
							body: {
								error: {
									code: "ACCOUNT_DELETION_BLOCKED",
									message: "Make another member Admin first.",
								},
							},
						},
		});
		renderModal();
		const user = userEvent.setup();
		await user.type(await screen.findByRole("textbox"), "minhanh");
		await user.click(confirmButton());
		expect(
			await screen.findByText("Make another member Admin first."),
		).toBeInTheDocument();
		expect(navigation.reloadAt).not.toHaveBeenCalled();
	});
});
