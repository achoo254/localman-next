import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { findToast } from "../../test/toast";
import {
	COLLECTION,
	EMAIL_ONLY,
	LAN,
	accessView,
	allById,
	apiError,
	byId,
	renderDialog,
	share,
	summary,
} from "./sharing-test-helpers";

async function findDialog() {
	const dialog = await screen.findByRole("dialog", {
		name: "Share “Orders API”",
	});
	await waitFor(() => expect(allById("share-access-item")).toHaveLength(2));
	return dialog;
}

describe("ShareDialog", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("renders nothing while the workspaces flag is off", () => {
		renderDialog({}, {}, { ...NO_FEATURES, workspaces: false });
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("lists the workspace and every share, email-only invitations included", async () => {
		renderDialog({});
		await findDialog();
		expect(byId("share-access-workspace")).toHaveTextContent(
			"Everyone in Team PaymentsBy workspace role",
		);
		const [lan, email] = allById("share-access-item");
		expect(lan).toHaveTextContent("Lan@lan");
		expect(email).toHaveTextContent(
			"new@example.comInvited by email, no account yet",
		);
		// No environments yet (phase 13): the field stays hidden.
		expect(byId("share-people-include-env")).toBeNull();
	});

	it("shares by username as Viewer by default, with an environment when chosen", async () => {
		const { calls } = renderDialog(
			{
				[`POST ${COLLECTION}/shares`]: {
					body: accessView([LAN, EMAIL_ONLY, share("hoa")]),
				},
			},
			{ environments: [{ id: "e1", name: "Staging" }] },
		);
		await findDialog();
		expect(byId("share-people-role")).toHaveValue("viewer");
		await userEvent.click(screen.getByRole("button", { name: "Share" }));
		expect(
			await screen.findByText("Enter a username or email."),
		).toBeInTheDocument();
		await userEvent.type(screen.getByLabelText("Username or email"), "hoa");
		await userEvent.selectOptions(
			screen.getByLabelText("Include environment"),
			"e1",
		);
		await userEvent.click(screen.getByRole("button", { name: "Share" }));
		await waitFor(() => expect(allById("share-access-item")).toHaveLength(3));
		expect(byId("share-people-match")).toHaveTextContent(
			"Shared with hoa as Viewer",
		);
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			usernameOrEmail: "hoa",
			role: "viewer",
			includeEnvironmentId: "e1",
		});
	});

	it("shows why a share was refused", async () => {
		renderDialog({
			[`POST ${COLLECTION}/shares`]: apiError(404, "INVITEE_NOT_FOUND"),
		});
		await findDialog();
		await userEvent.type(screen.getByLabelText("Username or email"), "ghost");
		await userEvent.click(screen.getByRole("button", { name: "Share" }));
		expect(
			await screen.findByText(
				"No account uses this username. Check it, or share by email.",
			),
		).toBeInTheDocument();
	});

	it("changes a role and removes a share", async () => {
		const { calls } = renderDialog({
			[`PATCH ${COLLECTION}/shares/s-lan`]: {
				body: accessView([{ ...LAN, role: "editor" }, EMAIL_ONLY]),
			},
			[`DELETE ${COLLECTION}/shares/s-lan`]: {
				body: { dryRun: false, removed: true, share: LAN },
			},
		});
		await findDialog();
		const role = screen.getByRole("combobox", { name: "Role of Lan" });
		await userEvent.selectOptions(role, "editor");
		expect(await findToast("Lan is now Editor")).toBeVisible();
		expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
			role: "editor",
		});
		await userEvent.click(
			screen.getByRole("button", { name: "Remove access for Lan" }),
		);
		expect(await findToast("Removed access for Lan")).toBeVisible();
		await waitFor(() => expect(allById("share-access-item")).toHaveLength(1));
	});

	it("locks sharing for an item in a personal workspace", async () => {
		renderDialog({
			[`GET ${COLLECTION}/access`]: { body: accessView([], "personal") },
		});
		await screen.findByRole("dialog");
		expect(
			await screen.findByText("This is in a personal workspace"),
		).toBeVisible();
		expect(byId("share-people-personal")).toHaveTextContent(
			"Move it to a team workspace to share it.",
		);
		expect(screen.getByLabelText("Username or email")).toBeDisabled();
		expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
	});

	it("is read-only for a Viewer", async () => {
		renderDialog({ [`GET ${COLLECTION}`]: summary({ role: "viewer" }) });
		await findDialog();
		expect(byId("share-people-read-only")).toHaveTextContent(
			"Only Editors can share it or change who has access.",
		);
		expect(screen.getByLabelText("Username or email")).toBeDisabled();
		expect(
			screen.getByRole("combobox", { name: "Role of Lan" }),
		).toBeDisabled();
		expect(byId("share-access-remove")).toBeNull();
	});

	it("gives collections a Link tab with the item's address", async () => {
		renderDialog({});
		const dialog = await findDialog();
		await userEvent.click(within(dialog).getByRole("tab", { name: "Link" }));
		expect(byId("share-link-input")).toHaveValue(
			`${window.location.origin}/elements/collection/c1`,
		);
		expect(byId("share-copy-link")).toBeInTheDocument();
		expect(dialog).toHaveTextContent(
			"Only people with access can open the link; others see Request access.",
		);
	});

	it("gives environments People only", async () => {
		const env = "/api/v1/elements/environment/e1";
		renderDialog(
			{
				[`GET ${env}`]: summary({ type: "environment", id: "e1" }),
				[`GET ${env}/access`]: { body: accessView([LAN]) },
			},
			{ elementType: "environment", elementId: "e1" },
		);
		await screen.findByRole("dialog");
		await waitFor(() => expect(allById("share-access-item")).toHaveLength(1));
		expect(screen.queryByRole("tab")).toBeNull();
	});
});
