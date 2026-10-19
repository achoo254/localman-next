import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { byId } from "../collections/collections-test-utils";
import {
	COMMENTS,
	comment,
	openComments,
	renderShop,
	thread,
} from "./comments-test-utils";

function stubClipboard(writeText: (text: string) => Promise<void>) {
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	Reflect.deleteProperty(navigator, "clipboard");
});

const commentItem = (id: string): HTMLElement => {
	const item = document.querySelector<HTMLElement>(`[data-comment-id="${id}"]`);
	if (!item) throw new Error(`no comment item ${id}`);
	return item;
};

describe("copying a comment's link", () => {
	it("writes the link to that comment on the collection to the clipboard", async () => {
		const writeText = vi.fn(async (_text: string) => undefined);
		renderShop({
			[`GET ${COMMENTS}`]: {
				body: {
					threads: [
						thread("t1", [
							comment("t1", "First"),
							comment("c2", "Second", { authorName: "Ada" }),
						]),
					],
				},
			},
		});
		const user = await openComments();
		// After userEvent.setup(), which installs its own clipboard stub.
		stubClipboard(writeText);
		await screen.findByText("Second");
		await user.click(
			within(commentItem("c2")).getByRole("button", { name: "Copy link" }),
		);
		await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
		expect(writeText).toHaveBeenCalledWith(
			`${window.location.origin}/elements/collection/c1?comment=c2`,
		);
		expect(await screen.findByText("Link copied")).toBeVisible();
	});
});

describe("editing your own comment", () => {
	it("changes the text, saves it, and shows the edited comment", async () => {
		let text = "Sure";
		let edited = false;
		const { calls } = renderShop({
			[`GET ${COMMENTS}`]: () => ({
				body: {
					threads: [
						thread("t1", [
							comment("t1", "Rename **this**?"),
							comment("c2", text, {
								authorName: "Ada",
								editedAt: edited ? "2026-10-16T03:00:00.000Z" : null,
								canEdit: true,
								canDelete: true,
							}),
						]),
					],
				},
			}),
			[`PATCH ${COMMENTS}/c2`]: ({ body }) => {
				text = (body as { body: string }).body;
				edited = true;
				return { body: { id: "c2" } };
			},
		});
		const user = await openComments();
		const item = commentItem("c2");
		await user.click(await within(item).findByRole("button", { name: "Edit" }));
		const field = within(item).getByRole("combobox", {
			name: "Edit your comment",
		});
		expect(field).toHaveValue("Sure");
		await user.clear(field);
		await user.type(field, "Sure, **yes**");
		await user.click(within(item).getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
				body: "Sure, **yes**",
			}),
		);
		expect(
			await within(commentItem("c2")).findByText("yes", { selector: "strong" }),
		).toBeVisible();
		expect(within(commentItem("c2")).getByText(/\(edited\)$/)).toBeVisible();
		expect(
			within(commentItem("c2")).queryByRole("combobox", {
				name: "Edit your comment",
			}),
		).toBeNull();
		expect(byId("comment-thread")).toHaveTextContent("Rename this?");
	});
});
