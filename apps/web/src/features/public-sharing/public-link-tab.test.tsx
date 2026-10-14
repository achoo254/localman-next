import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall, MockReply } from "../../test/mock-fetch";
import {
	FLAGS_ON,
	apiError,
	renderDialog,
} from "../sharing/sharing-test-helpers";

const FLAGS = { ...FLAGS_ON, publicSharing: true };
const PUBLIC_LINK = "/api/v1/collections/c1/public-link";
const LINK = {
	kind: "public",
	url: "https://localman.test/public/c/lnk_123",
	createdBy: "user-1",
	createdAt: "2026-10-14T01:00:00.000Z",
};
const WARNINGS = [{ where: "collectionVariable", path: [], key: "apiKey" }];

/** The dialog's other calls, all empty. */
const EMPTY = {
	[`GET ${PUBLIC_LINK}`]: { body: { link: null } },
	"GET /api/v1/collections/c1/guest-link": { body: { link: null } },
	"GET /api/v1/collections/c1/access-keys": { body: { items: [] } },
};

async function openPublicTab() {
	await userEvent.click(await screen.findByRole("tab", { name: "Public" }));
	return screen.findByRole("switch", { name: "Public link" });
}

describe("Share dialog, Public tab", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("hides the public sharing tabs while the flag is off", async () => {
		renderDialog({ ...EMPTY });
		await screen.findByRole("tab", { name: "Link" });
		expect(screen.queryByRole("tab", { name: "Public" })).toBeNull();
		expect(screen.queryByRole("tab", { name: "Keys" })).toBeNull();
		expect(screen.queryByRole("tab", { name: "Run" })).toBeNull();
	});

	it("runs a dry run, confirms with the warnings, then shows the link", async () => {
		const enable = (call: FetchCall): MockReply =>
			call.query.get("dryRun") === "true"
				? { body: { dryRun: true, link: null, warnings: WARNINGS } }
				: { body: { dryRun: false, link: LINK, warnings: WARNINGS } };
		const { calls } = renderDialog(
			{ ...EMPTY, [`POST ${PUBLIC_LINK}`]: enable },
			{},
			FLAGS,
		);
		const toggle = await openPublicTab();
		expect(toggle).toHaveAttribute("aria-checked", "false");
		await userEvent.click(toggle);

		const confirm = await screen.findByRole("region", {
			name: "Publish a public link?",
		});
		expect(within(confirm).getByRole("alert")).toHaveTextContent(
			"1 value looks like a secret",
		);
		expect(within(confirm).getByRole("listitem")).toHaveTextContent(
			"Collection variableCollectionapiKey",
		);
		const posts = () => calls.filter((c) => c.method === "POST");
		expect(posts().map((c) => c.query.get("dryRun"))).toEqual(["true"]);

		await userEvent.click(
			within(confirm).getByRole("button", { name: "Publish link" }),
		);
		expect(await screen.findByDisplayValue(LINK.url)).toBeInTheDocument();
		expect(screen.getByRole("switch", { name: "Public link" })).toHaveAttribute(
			"aria-checked",
			"true",
		);
		expect(posts().map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
		expect(
			screen.queryByRole("region", { name: "Publish a public link?" }),
		).toBeNull();
	});

	it("explains when the workspace turned public links off", async () => {
		renderDialog(
			{
				...EMPTY,
				[`POST ${PUBLIC_LINK}`]: apiError(403, "PUBLIC_LINKS_DISABLED"),
			},
			{},
			FLAGS,
		);
		await userEvent.click(await openPublicTab());
		expect(
			await screen.findByText(
				"Public links are turned off for this workspace. An Admin can turn them on in workspace settings.",
			),
		).toBeInTheDocument();
		expect(screen.getByRole("switch", { name: "Public link" })).toHaveAttribute(
			"aria-checked",
			"false",
		);
	});

	it("turns a link off after confirming", async () => {
		const { calls } = renderDialog(
			{
				...EMPTY,
				[`GET ${PUBLIC_LINK}`]: { body: { link: LINK } },
				[`DELETE ${PUBLIC_LINK}`]: { body: { dryRun: false, disabled: true } },
			},
			{},
			FLAGS,
		);
		const toggle = await openPublicTab();
		await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
		await userEvent.click(toggle);
		const modal = await screen.findByRole("dialog", {
			name: "Turn off the public link",
		});
		await userEvent.click(
			within(modal).getByRole("button", { name: "Turn off" }),
		);
		await waitFor(() =>
			expect(
				screen.getByRole("switch", { name: "Public link" }),
			).toHaveAttribute("aria-checked", "false"),
		);
		expect(screen.queryByDisplayValue(LINK.url)).toBeNull();
		expect(calls.some((c) => c.method === "DELETE")).toBe(true);
	});
});
