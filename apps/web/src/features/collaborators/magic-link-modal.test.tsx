import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../platform/clipboard";
import { seriousViolations } from "../../test/axe";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";
import {
	EXPIRES,
	MAGIC,
	MEMBERS,
	apiError,
	listBody,
	member,
	openFromMenu,
} from "./collaborators-test-helpers";

vi.mock("../../platform/clipboard", () => ({ copyText: vi.fn() }));

const CREATED_AT = "2026-10-09T01:00:00.000Z";
const NONE = { status: "none", expiresAt: null, createdAt: null };
const ACTIVE = { status: "active", expiresAt: EXPIRES, createdAt: CREATED_AT };
const CREATED = { body: { ...ACTIVE, link: "/invite/magicTok" } };
const LINK_URL = `${window.location.origin}/invite/magicTok`;

const open = (routes: Parameters<typeof openFromMenu>[0]) =>
	openFromMenu(
		{ [`GET ${MEMBERS}`]: listBody([]), ...routes },
		{ item: "Magic link" },
	);

const byId = (root: HTMLElement, id: string) =>
	root.querySelector(`[data-id="${id}"]`);

describe("magic link dialog", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.mocked(copyText).mockResolvedValue(true);
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("creates a link, shows it once and copies it", async () => {
		const { dialog } = await open({
			[`GET ${MAGIC}`]: { body: NONE },
			[`POST ${MAGIC}`]: { status: 201, body: CREATED.body },
		});
		expect(dialog).toHaveTextContent("The link can be used many times");
		const create = await within(dialog).findByRole("button", {
			name: "Create magic link",
		});
		expect(dialog).toHaveTextContent("No active magic link.");
		await userEvent.click(create);
		const input = await within(dialog).findByLabelText("Magic link");
		expect(input).toHaveValue(LINK_URL);
		expect(dialog).toHaveTextContent("The link is shown only this once");
		expect(byId(dialog, "modal-magic-link-expiry")).toHaveTextContent(
			"Expires Oct 16, 2026.",
		);
		expect(byId(dialog, "modal-magic-link-copy")).toHaveFocus();
		expect(await seriousViolations(dialog)).toEqual([]);
		const footer = within(dialog).getAllByRole("button", {
			name: "Copy link",
		});
		await userEvent.click(footer[footer.length - 1] as HTMLElement);
		expect(copyText).toHaveBeenCalledWith(LINK_URL);
	});

	it("replaces an active link after confirmation", async () => {
		const { calls, dialog } = await open({
			[`GET ${MAGIC}`]: { body: ACTIVE },
			[`POST ${MAGIC}`]: { status: 201, body: CREATED.body },
		});
		const status = await waitFor(() => {
			const node = byId(dialog, "modal-magic-link-status");
			if (!node) throw new Error("loading");
			return node;
		});
		expect(status).toHaveTextContent("Active");
		expect(status).toHaveTextContent("Created Oct 9, 2026");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create new link" }),
		);
		const confirm = screen.getByRole("dialog", { name: "Create new link" });
		expect(confirm).toHaveTextContent("The old link stops working right away.");
		expect(calls.some((c) => c.method === "POST")).toBe(false);
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Create new link" }),
		);
		expect(await within(dialog).findByLabelText("Magic link")).toHaveValue(
			LINK_URL,
		);
	});

	it("revokes an active link", async () => {
		const { dialog } = await open({
			[`GET ${MAGIC}`]: { body: ACTIVE },
			[`DELETE ${MAGIC}`]: { body: { ...ACTIVE, status: "revoked" } },
		});
		await userEvent.click(
			await within(dialog).findByRole("button", { name: "Revoke" }),
		);
		const confirm = screen.getByRole("dialog", { name: "Revoke magic link" });
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Revoke" }),
		);
		expect(await findToast("Revoked the magic link")).toBeInTheDocument();
		const create = within(dialog).getByRole("button", {
			name: "Create magic link",
		});
		await waitFor(() => expect(create).toHaveFocus());
	});

	it("recreates an expired link without asking", async () => {
		const { dialog } = await open({
			[`GET ${MAGIC}`]: { body: { ...ACTIVE, status: "expired" } },
			[`POST ${MAGIC}`]: { status: 201, body: CREATED.body },
		});
		await within(dialog).findByText("Expired");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create new link" }),
		);
		expect(await within(dialog).findByLabelText("Magic link")).toHaveValue(
			LINK_URL,
		);
	});

	it("warns when the project is full, with no plans to open", async () => {
		const { dialog } = await open({
			[`GET ${MEMBERS}`]: listBody([member("an"), member("binh")]),
			[`GET ${MAGIC}`]: { body: NONE },
		});
		const full = await waitFor(() => {
			const node = byId(dialog, "modal-magic-link-full");
			if (!node) throw new Error("not yet");
			return node;
		});
		expect(full).toHaveTextContent("The project already has 3/3 members.");
		expect(full.querySelector("button")).toBeNull();
	});

	it("shows load errors with a retry", async () => {
		let fail = true;
		const { dialog } = await open({
			[`GET ${MAGIC}`]: () =>
				fail ? apiError(500, "INTERNAL") : { body: NONE },
		});
		const retry = await within(dialog).findByRole("button", {
			name: "Try again",
		});
		expect(byId(dialog, "modal-magic-link-error")).toHaveTextContent(
			"INTERNAL",
		);
		fail = false;
		await userEvent.click(retry);
		expect(
			await within(dialog).findByRole("button", { name: "Create magic link" }),
		).toBeInTheDocument();
	});
});
