import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../features/auth/use-current-user";
import {
	ACCEPT,
	PREVIEW,
	preview,
	renderInvite,
	tokenError,
} from "./accept-invite-test-helpers";

const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);

describe("/invite/:token eligibility", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("explains an invite meant for another account and offers to switch", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "NOT_INVITEE" }),
		});
		await screen.findByText("This account can't accept the invitation");
		expect(byId("invite-page-ineligible")).toHaveTextContent(
			"The invitation was sent to t***@example.com.",
		);
		expect(screen.queryByRole("button", { name: "Join" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "Sign in with another account" }),
		).toBeInTheDocument();
	});

	it("explains an unverified email", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "EMAIL_NOT_VERIFIED" }),
		});
		expect(
			await screen.findByText(/This account's email isn't verified/),
		).toBeInTheDocument();
	});

	it("tells members they already belong to the project", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "ALREADY_MEMBER" }),
		});
		expect(
			await screen.findByText("You're already a member of Demo shop."),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Open project" })).toHaveAttribute(
			"href",
			"/projects/p1",
		);
		expect(screen.queryByRole("button", { name: "Join" })).toBeNull();
	});

	it("says a full project cannot take more members, without an upgrade", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "MEMBER_LIMIT" }),
		});
		expect(
			await screen.findByText(
				/The project already has as many members as the owner's plan allows/,
			),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Join" })).toBeNull();
		expect(screen.queryByRole("button", { name: "See plans" })).toBeNull();
	});

	it("tells a member the owner removed that the link no longer admits them", async () => {
		renderInvite({
			[PREVIEW]: preview({ eligible: false, reason: "REMOVED_BY_OWNER" }),
		});
		expect(
			await screen.findByText(
				"The project owner removed you from this project. Contact the project owner if you need to join again.",
			),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Join" })).toBeNull();
	});

	it.each([
		[403, "REMOVED_BY_OWNER", "invite-page-removed"],
		[403, "EMAIL_NOT_VERIFIED", "invite-page-ineligible"],
		[403, "PLAN_LIMIT_REACHED", "invite-page-full"],
		[410, "INVITE_USED", "invite-page-invalid"],
	])("maps a refused accept (%s %s) to its state", async (status, code, id) => {
		renderInvite({ [PREVIEW]: preview(), [ACCEPT]: tokenError(status, code) });
		await userEvent.click(await screen.findByRole("button", { name: "Join" }));
		await screen.findByRole("heading", { level: 1 });
		await vi.waitFor(() => expect(byId(id)).not.toBeNull());
	});

	it("keeps Join for other accept errors", async () => {
		renderInvite({
			[PREVIEW]: preview(),
			[ACCEPT]: tokenError(429, "RATE_LIMITED"),
		});
		await userEvent.click(await screen.findByRole("button", { name: "Join" }));
		expect(
			await screen.findByText(
				"You've opened too many invite links. Try again in a few minutes.",
			),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Join" })).toBeEnabled();
	});

	it("retries a preview that failed", async () => {
		let fail = true;
		renderInvite({
			[PREVIEW]: () => (fail ? tokenError(500, "INTERNAL") : preview()),
		});
		await screen.findByRole("heading", {
			name: "Couldn't open the invitation",
		});
		// API messages are English: the page shows its own Vietnamese text.
		expect(byId("invite-page-error")).toHaveTextContent(
			"Couldn't open the invitation. Try again later.",
		);
		expect(byId("invite-page-error")).not.toHaveTextContent("INTERNAL");
		fail = false;
		await userEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(
			await screen.findByRole("heading", { name: "Join Demo shop" }),
		).toBeInTheDocument();
	});

	it("treats a malformed token as an invalid link, without a retry", async () => {
		renderInvite({ [PREVIEW]: tokenError(400, "VALIDATION_ERROR") });
		expect(
			await screen.findByRole("heading", {
				name: "This invite link is no longer valid",
			}),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
	});

	it("explains a CONFLICT on accept in Vietnamese", async () => {
		renderInvite({
			[PREVIEW]: preview(),
			[ACCEPT]: tokenError(409, "CONFLICT"),
		});
		await userEvent.click(await screen.findByRole("button", { name: "Join" }));
		expect(
			await screen.findByText("The invitation just changed. Please try again."),
		).toBeInTheDocument();
	});
});
