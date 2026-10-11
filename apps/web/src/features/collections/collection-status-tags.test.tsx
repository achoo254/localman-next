import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchCall } from "../../test/mock-fetch";
import {
	LIST_PATH,
	byId,
	detail,
	findRow,
	renderWorkbenchPage,
	summary,
} from "./collections-test-utils";

afterEach(() => vi.unstubAllGlobals());

const PATCH = "PATCH /api/v1/collections/c1";

function renderShop(role: "editor" | "viewer" = "editor", tags: string[] = []) {
	let stored = detail("c1", [], { name: "Shop", role, tags });
	return renderWorkbenchPage(
		{
			[`GET ${LIST_PATH}`]: () => ({
				body: { items: [summary("c1", { name: "Shop", role })] },
			}),
			"GET /api/v1/collections/c1": () => ({ body: stored }),
			[PATCH]: ({ body }) => {
				stored = {
					...stored,
					...(typeof body === "object" && body ? body : {}),
				};
				return { body: stored };
			},
		},
		{ role: role === "viewer" ? "viewer" : "admin" },
	);
}

const patches = (calls: FetchCall[]) =>
	calls.filter((c) => c.method === "PATCH");

async function openShop() {
	const user = userEvent.setup();
	await user.click(await findRow("c1"));
	await screen.findByRole("textbox", { name: "Collection name" });
	return user;
}

describe("collection status", () => {
	it("sets a preset from the header menu", async () => {
		const { calls } = renderShop();
		const user = await openShop();
		await user.click(byId("collection-header-status") as HTMLElement);
		const menu = await screen.findByRole("menu");
		await user.click(
			within(menu).getByRole("menuitemradio", { name: /Stable/ }),
		);
		await waitFor(() =>
			expect(patches(calls).at(-1)?.body).toEqual({
				status: { kind: "preset", preset: "stable" },
			}),
		);
		expect(await screen.findByText("Stable")).toBeVisible();
		await user.click(byId("collection-header-status") as HTMLElement);
		const again = await screen.findByRole("menu");
		expect(
			within(again).getByRole("menuitemradio", { name: /Stable/ }),
		).toHaveAttribute("aria-checked", "true");
		expect(
			within(again)
				.getAllByRole("menuitemradio")
				.filter((item) => item.getAttribute("aria-checked") === "true"),
		).toHaveLength(1);
	});

	it("checks a custom status before saving it", async () => {
		const { calls } = renderShop();
		const user = await openShop();
		await user.click(byId("collection-header-status") as HTMLElement);
		await user.click(
			await screen.findByRole("menuitem", { name: "Custom status…" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Custom status" });
		const name = within(dialog).getByRole("textbox", { name: "Name" });
		await user.type(name, "1st");
		const emoji = within(dialog).getByRole("textbox", {
			name: "Or type one emoji",
		});
		await user.clear(emoji);
		await user.type(emoji, "ab");
		await user.click(
			within(dialog).getByRole("button", { name: "Save status" }),
		);
		expect(
			await within(dialog).findByText("Start the name with a letter."),
		).toBeVisible();
		expect(patches(calls)).toHaveLength(0);
		await user.clear(name);
		await user.type(name, "Beta");
		await user.click(within(dialog).getByRole("button", { name: "🚀" }));
		await user.click(
			within(dialog).getByRole("button", { name: "Save status" }),
		);
		await waitFor(() =>
			expect(patches(calls).at(-1)?.body).toEqual({
				status: { kind: "custom", name: "Beta", emoji: "🚀" },
			}),
		);
	});
});

describe("collection tags", () => {
	it("adds a tag in lower case and refuses one that breaks the rules", async () => {
		const { calls } = renderShop();
		const user = await openShop();
		const input = screen.getByRole("textbox", { name: "New tag" });
		await user.type(input, "-bad{Enter}");
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Start and end a tag with a letter or digit.",
		);
		expect(patches(calls)).toHaveLength(0);
		await user.clear(input);
		await user.type(input, "Payments{Enter}");
		await waitFor(() =>
			expect(patches(calls).at(-1)?.body).toEqual({ tags: ["payments"] }),
		);
		expect(await screen.findByText("Tags 1/10")).toBeVisible();
	});

	it("only shows status and tags to a Viewer", async () => {
		renderShop("viewer", ["internal"]);
		await openShop();
		expect(byId("collection-header-status")).toBeNull();
		expect(screen.queryByRole("textbox", { name: "New tag" })).toBeNull();
		expect(byId("collection-tags-item")).toHaveTextContent("internal");
		expect(
			screen.queryByRole("button", { name: "Remove tag internal" }),
		).toBeNull();
	});
});
