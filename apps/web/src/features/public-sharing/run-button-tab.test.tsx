import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall, MockReply } from "../../test/mock-fetch";
import { FLAGS_ON, renderDialog } from "../sharing/sharing-test-helpers";
import { allById, byId } from "./public-sharing-test-helpers";
import type { RunButton } from "./run-buttons-api";

const FLAGS = { ...FLAGS_ON, publicSharing: true };
const BUTTONS = "/api/v1/collections/c1/run-buttons";

const BUTTON: RunButton = {
	id: "rb1",
	visibility: "public",
	environmentId: "e1",
	url: "https://localman.test/run/btn_1",
	badgeUrl: "https://localman.test/run-button.svg",
	createdBy: "user-1",
	createdAt: "2026-10-14T01:00:00.000Z",
};

const EMPTY = {
	"GET /api/v1/collections/c1/public-link": { body: { link: null } },
	"GET /api/v1/collections/c1/guest-link": { body: { link: null } },
	"GET /api/v1/collections/c1/access-keys": { body: { items: [] } },
};

describe("Share dialog, Run tab", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("creates a public button with an environment and shows its embed codes", async () => {
		const create = (call: FetchCall): MockReply =>
			call.query.get("dryRun") === "true"
				? {
						status: 201,
						body: {
							dryRun: true,
							button: null,
							warnings: [{ where: "script", path: [], key: "pre" }],
						},
					}
				: {
						status: 201,
						body: { dryRun: false, button: BUTTON, warnings: [] },
					};
		const { calls } = renderDialog(
			{
				...EMPTY,
				[`GET ${BUTTONS}`]: { body: { items: [] } },
				[`POST ${BUTTONS}`]: create,
			},
			{ environments: [{ id: "e1", name: "Staging" }] },
			FLAGS,
		);
		await userEvent.click(await screen.findByRole("tab", { name: "Run" }));
		const tab = await screen.findByRole("region", {
			name: "Run in Localman button",
		});
		expect(await within(tab).findByText("No Run buttons yet.")).toBeVisible();
		await userEvent.click(within(tab).getByRole("button", { name: "Anyone" }));
		await userEvent.selectOptions(
			within(tab).getByLabelText(/Environment/),
			"e1",
		);
		await userEvent.click(
			within(tab).getByRole("button", { name: "Create button" }),
		);
		const confirm = await within(tab).findByRole("region", {
			name: "Create a Run button?",
		});
		expect(within(confirm).getByRole("listitem")).toHaveTextContent(
			"ScriptCollectionpre",
		);
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Create button" }),
		);
		await waitFor(() => expect(allById("share-run-item")).toHaveLength(1));
		expect(byId("share-run-item")).toHaveTextContent("Environment: Staging");
		expect(byId("share-run-markdown")).toHaveTextContent(
			`[![Run in Localman](${BUTTON.badgeUrl})](${BUTTON.url})`,
		);
		expect(byId("share-run-html")).toHaveTextContent(
			`<a href="${BUTTON.url}"><img src="${BUTTON.badgeUrl}" alt="Run in Localman"></a>`,
		);
		const posts = calls.filter((c) => c.method === "POST");
		expect(posts.map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
		expect(posts[1]?.body).toEqual({
			visibility: "public",
			environmentId: "e1",
		});
	});

	it("deletes a button after confirming", async () => {
		renderDialog(
			{
				...EMPTY,
				[`GET ${BUTTONS}`]: { body: { items: [BUTTON] } },
				[`DELETE ${BUTTONS}/rb1`]: {
					body: { dryRun: false, deleted: true, button: null },
				},
			},
			{},
			FLAGS,
		);
		await userEvent.click(await screen.findByRole("tab", { name: "Run" }));
		await userEvent.click(
			await screen.findByRole("button", { name: /Delete button created/ }),
		);
		const modal = await screen.findByRole("dialog", {
			name: "Delete Run button",
		});
		await userEvent.click(
			within(modal).getByRole("button", { name: "Delete button" }),
		);
		expect(await screen.findByText("No Run buttons yet.")).toBeInTheDocument();
	});
});
