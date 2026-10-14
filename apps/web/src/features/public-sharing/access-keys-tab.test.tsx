import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall, MockReply } from "../../test/mock-fetch";
import {
	FLAGS_ON,
	apiError,
	renderDialog,
} from "../sharing/sharing-test-helpers";
import type { AccessKey } from "./access-keys-api";
import { allById, byId } from "./public-sharing-test-helpers";

const FLAGS = { ...FLAGS_ON, publicSharing: true };
const KEYS = "/api/v1/collections/c1/access-keys";
const SECRET = "lmk_live_9f8e7d6c5b4a39281706f5e4d3c2b1a0";

const accessKey = (id: string, name: string): AccessKey => ({
	id,
	name,
	last4: "b1a0",
	userId: "user-1",
	createdAt: "2026-10-14T01:00:00.000Z",
	lastUsedAt: null,
	expiresAt: "2026-12-13T01:00:00.000Z",
});

const EMPTY = {
	"GET /api/v1/collections/c1/public-link": { body: { link: null } },
	"GET /api/v1/collections/c1/guest-link": { body: { link: null } },
};

async function openKeysTab() {
	await userEvent.click(await screen.findByRole("tab", { name: "Keys" }));
	return screen.findByRole("region", { name: "Access keys" });
}

describe("Share dialog, Keys tab", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("creates a key after confirming and shows it once", async () => {
		const create = (call: FetchCall): MockReply =>
			call.query.get("dryRun") === "true"
				? {
						status: 201,
						body: { dryRun: true, key: null, accessKey: null, warnings: [] },
					}
				: {
						status: 201,
						body: {
							dryRun: false,
							key: SECRET,
							accessKey: accessKey("k2", "CI"),
							warnings: [],
						},
					};
		const { calls } = renderDialog(
			{
				...EMPTY,
				[`GET ${KEYS}`]: { body: { items: [accessKey("k1", "Docs site")] } },
				[`POST ${KEYS}`]: create,
			},
			{},
			FLAGS,
		);
		const tab = await openKeysTab();
		expect(byId("share-keys-curl")).toHaveTextContent(
			"/api/v1/public/collections/c1?access_key=<YOUR_KEY>",
		);
		await userEvent.click(
			within(tab).getByRole("button", { name: "Create key" }),
		);
		expect(
			await within(tab).findByText("Enter a name for the key."),
		).toBeVisible();

		await userEvent.type(within(tab).getByLabelText("Key name"), "CI");
		await userEvent.click(
			within(tab).getByRole("button", { name: "Create key" }),
		);
		const confirm = await within(tab).findByRole("region", {
			name: "Create an access key?",
		});
		expect(confirm).toHaveTextContent(
			"No values that look like secrets were found.",
		);
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Create key" }),
		);
		expect(await within(tab).findByDisplayValue(SECRET)).toBeInTheDocument();
		await waitFor(() => expect(allById("share-key-item")).toHaveLength(2));
		expect(byId("share-keys-curl")).not.toHaveTextContent(SECRET);
		const posts = calls.filter((c) => c.method === "POST");
		expect(posts.map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
		expect(posts[1]?.body).toEqual({ name: "CI" });
	});

	it("revokes a key after confirming", async () => {
		renderDialog(
			{
				...EMPTY,
				[`GET ${KEYS}`]: { body: { items: [accessKey("k1", "Docs site")] } },
				[`DELETE ${KEYS}/k1`]: {
					body: { dryRun: false, revoked: true, accessKey: null },
				},
			},
			{},
			FLAGS,
		);
		const tab = await openKeysTab();
		await userEvent.click(
			await within(tab).findByRole("button", { name: "Revoke Docs site" }),
		);
		const modal = await screen.findByRole("dialog", {
			name: "Revoke access key",
		});
		await userEvent.click(
			within(modal).getByRole("button", { name: "Revoke key" }),
		);
		expect(await screen.findByText("No access keys yet.")).toBeInTheDocument();
	});

	it("explains the per-person limit", async () => {
		renderDialog(
			{
				...EMPTY,
				[`GET ${KEYS}`]: { body: { items: [] } },
				[`POST ${KEYS}`]: apiError(409, "ACCESS_KEY_LIMIT_REACHED"),
			},
			{},
			FLAGS,
		);
		const tab = await openKeysTab();
		await userEvent.type(within(tab).getByLabelText("Key name"), "CI");
		await userEvent.click(
			within(tab).getByRole("button", { name: "Create key" }),
		);
		expect(
			await within(tab).findByText(/the most access keys allowed/),
		).toBeInTheDocument();
	});
});
