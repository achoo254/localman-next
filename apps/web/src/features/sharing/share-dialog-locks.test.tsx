import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	COLLECTION,
	LAN,
	accessView,
	allById,
	byId,
	renderDialog,
	share,
	summary,
} from "./sharing-test-helpers";

/** An email share as a non-manager receives it: the API hides the address. */
const HIDDEN_EMAIL = share("x", {
	userId: null,
	username: null,
	name: null,
	email: null,
});

describe("ShareDialog locks and fallbacks", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("names an email share without its address for people who cannot manage", async () => {
		renderDialog({
			[`GET ${COLLECTION}`]: summary({ role: "viewer" }),
			[`GET ${COLLECTION}/access`]: { body: accessView([LAN, HIDDEN_EMAIL]) },
		});
		await waitFor(() => expect(allById("share-access-item")).toHaveLength(2));
		expect(allById("share-access-item")[1]).toHaveTextContent(
			"Someone invited by emailInvited by email, no account yet",
		);
		expect(
			screen.getByRole("combobox", {
				name: "Role of Someone invited by email",
			}),
		).toBeDisabled();
	});

	it("locks sharing when the item's workspace no longer exists", async () => {
		renderDialog({
			[`GET ${COLLECTION}/access`]: {
				body: { workspace: null, shares: [LAN] },
			},
		});
		expect(
			await screen.findByText(
				"Its workspace no longer exists, so it can't be shared.",
			),
		).toBeVisible();
		expect(byId("share-people-workspace-missing")).toBeInTheDocument();
		expect(byId("share-access-workspace")).toHaveTextContent(
			"Its workspace no longer exists.",
		);
		expect(screen.getByLabelText("Username or email")).toBeDisabled();
		expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
	});
});
