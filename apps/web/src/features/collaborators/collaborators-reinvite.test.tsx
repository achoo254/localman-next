import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../platform/clipboard";
import { resetCurrentUserCache } from "../auth/use-current-user";
import {
	EXPIRES,
	LOOKUP,
	MEMBERS,
	apiError,
	member,
	memberStore,
	openFromMenu,
	person,
	typeAndLook,
} from "./collaborators-test-helpers";

vi.mock("../../platform/clipboard", () => ({ copyText: vi.fn() }));

const bob = person("bob");
const match = { body: { match: { ...bob, maskedEmail: null } } };
const pendingBob = (id: string, expiresAt = EXPIRES) =>
	member(id, { status: "pending", user: bob, acceptedAt: null, expiresAt });
const byId = (root: HTMLElement, id: string) =>
	root.querySelector(`[data-id="${id}"]`);

async function invite(dialog: HTMLElement, who: string) {
	await typeAndLook(dialog, who);
	await userEvent.click(
		await within(dialog).findByRole("button", { name: "Confirm invite" }),
	);
}

describe("inviting again and racing the member limit", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.mocked(copyText).mockResolvedValue(true);
	});
	afterEach(() => vi.unstubAllGlobals());

	it("keeps one row and the same seat count when @bob is invited twice", async () => {
		const store = memberStore([]);
		let round = 0;
		const { dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: store.get,
			[LOOKUP]: match,
			[`POST ${MEMBERS}`]: () => {
				round += 1;
				const expiresAt = `2026-10-1${5 + round}T01:00:00.000Z`;
				return store.invite(pendingBob("b1", expiresAt), { invitee: bob });
			},
		});
		await within(dialog).findByText("Minh Anh · @minhanh");
		await invite(dialog, "@bob");
		await waitFor(() =>
			expect(byId(dialog, "modal-collaborators-count")).toHaveTextContent(
				"2/3",
			),
		);
		await invite(dialog, "@bob");
		await within(dialog).findByLabelText("Invite link for Bob");
		await waitFor(() =>
			expect(
				dialog.querySelectorAll('[data-collaborator-id="b1"]'),
			).toHaveLength(1),
		);
		expect(byId(dialog, "modal-collaborators-count")).toHaveTextContent("2/3");
	});

	it("replaces an expired invitation that the server reuses", async () => {
		const expired = member("e1", {
			status: "expired",
			user: bob,
			acceptedAt: null,
			expiresAt: "2026-10-01T01:00:00.000Z",
		});
		const store = memberStore([expired]);
		const { dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: store.get,
			[LOOKUP]: match,
			[`POST ${MEMBERS}`]: () =>
				store.invite(pendingBob("e1"), { invitee: bob }),
		});
		const row = await waitFor(() => {
			const node = byId(dialog, "collaborator-bob");
			if (!node) throw new Error("loading");
			return node;
		});
		expect(row).toHaveTextContent("Expired");
		expect(byId(dialog, "modal-collaborators-count")).toHaveTextContent("1/3");
		await invite(dialog, "@bob");
		await waitFor(() =>
			expect(byId(dialog, "collaborator-bob")).toHaveTextContent("Pending"),
		);
		expect(dialog.querySelectorAll('[data-collaborator-id="e1"]')).toHaveLength(
			1,
		);
		expect(byId(dialog, "collaborator-bob")).not.toHaveTextContent("Expired");
		expect(byId(dialog, "modal-collaborators-count")).toHaveTextContent("2/3");
	});

	it("keeps the form, the list and the one-time link on PLAN_LIMIT_REACHED", async () => {
		const store = memberStore([member("an")], { max: 10 });
		let full = false;
		const { calls, dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: store.get,
			[LOOKUP]: match,
			[`POST ${MEMBERS}`]: () => {
				if (full) {
					return apiError(403, "PLAN_LIMIT_REACHED", { limit: "members" });
				}
				full = true;
				return store.invite(pendingBob("b1"), { invitee: bob });
			},
		});
		await within(dialog).findByText("An · @an");
		await invite(dialog, "@bob");
		const link = await within(dialog).findByLabelText("Invite link for Bob");
		const gets = () =>
			calls.filter((c) => c.method === "GET" && c.path === MEMBERS).length;
		const before = gets();
		await invite(dialog, "@bob");
		expect(
			await screen.findByRole("dialog", { name: "Manage plan" }),
		).toBeInTheDocument();
		await waitFor(() => expect(gets()).toBeGreaterThan(before));
		expect(link).toBeInTheDocument();
		expect(
			within(dialog).getByLabelText("Username or email"),
		).toBeInTheDocument();
		expect(byId(dialog, "modal-collaborators-loading")).toBeNull();
	});

	it("sends one DELETE when the cancel button is clicked twice", async () => {
		let release = () => {};
		const pending = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { calls, dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: memberStore([pendingBob("b1")]).get,
			[`DELETE ${MEMBERS}/b1`]: async () => {
				await pending;
				return { body: { removed: true } };
			},
		});
		const cancel = await within(dialog).findByRole("button", {
			name: "Cancel the invitation to Bob · @bob",
		});
		await userEvent.click(cancel);
		await waitFor(() =>
			expect(cancel).toHaveAttribute("aria-disabled", "true"),
		);
		await userEvent.click(cancel);
		release();
		await waitFor(() => expect(byId(dialog, "collaborator-bob")).toBeNull());
		expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
	});

	it("locks the input while the invitation is being sent", async () => {
		const store = memberStore([]);
		let release = () => {};
		const sent = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: store.get,
			[LOOKUP]: match,
			[`POST ${MEMBERS}`]: async () => {
				await sent;
				return store.invite(pendingBob("b1"), { invitee: bob });
			},
		});
		await within(dialog).findByText("Minh Anh · @minhanh");
		await invite(dialog, "@bob");
		const input = within(dialog).getByLabelText("Username or email");
		expect(input).toHaveAttribute("readonly");
		expect(input).toHaveValue("@bob");
		release();
		await within(dialog).findByLabelText("Invite link for Bob");
		expect(input).not.toHaveAttribute("readonly");
		expect(input).toHaveValue("");
	});
});
