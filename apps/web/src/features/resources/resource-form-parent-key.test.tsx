import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	RESOURCES_PATH,
	apiError,
	findNode,
	openNewResource,
	renderDetail,
	resourceJson,
	sampleTree,
} from "../../pages/project-detail/project-detail-test-helpers";
import { seriousViolations } from "../../test/axe";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";

async function openEdit(name: string): Promise<HTMLElement> {
	const node = await findNode(name);
	await userEvent.click(
		within(node).getByRole("button", { name: `Edit ${name}` }),
	);
	return screen.findByRole("dialog", { name: `Edit resource · ${name}` });
}

const keyField = (dialog: HTMLElement) =>
	within(dialog).getByRole("textbox", { name: /^Parent key/ });

const putBody = (calls: { method: string; body: unknown }[]) =>
	calls.find((call) => call.method === "PUT")?.body;

describe("Parent key in the resource form", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows the API's key, checks a new one as it is typed and sends it", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`PUT ${RESOURCES_PATH}/posts`]: {
				body: resourceJson("posts", {
					parentId: "users",
					parentKey: "ownerId",
				}),
			},
		});
		const dialog = await openEdit("posts");
		const key = keyField(dialog);
		expect(key).toHaveValue("userId");
		// The locked schema row shows the same key, from the API.
		expect(
			within(dialog).getByRole("textbox", { name: "Field userId" }),
		).toHaveValue("userId");
		expect(
			within(dialog).getByText(
				/clients already using the mock must change too/,
			),
		).toBeInTheDocument();
		expect(await seriousViolations(dialog)).toEqual([]);

		const user = userEvent.setup();
		await user.clear(key);
		await user.type(key, "user-id");
		expect(key).toHaveAttribute("aria-invalid", "true");
		expect(
			within(dialog).getByText(/^Use letters, numbers, _ and \$/),
		).toBeInTheDocument();
		await user.clear(key);
		await user.type(key, "name");
		expect(
			within(dialog).getByText("The field “name” already has this name."),
		).toBeInTheDocument();
		await user.clear(key);
		await user.type(key, "ownerId");
		expect(key).not.toHaveAttribute("aria-invalid");

		await user.click(within(dialog).getByRole("button", { name: "Update" }));
		expect(await findToast("Updated resource posts.")).toBeInTheDocument();
		expect(putBody(calls)).toMatchObject({ parentKey: "ownerId" });
	});

	it("leaves an unchanged key out of the update", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`PUT ${RESOURCES_PATH}/comments`]: { body: resourceJson("comments") },
		});
		const dialog = await openEdit("comments");
		expect(keyField(dialog)).toHaveValue("postId");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Update" }),
		);
		await findToast("Updated resource comments.");
		expect(putBody(calls)).not.toHaveProperty("parentKey");
	});

	it("puts the API's refusal on the field and keeps the modal open", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`PUT ${RESOURCES_PATH}/posts`]: apiError(400, "VALIDATION_ERROR", [
				{ path: "parentKey", message: "parentKey is not allowed" },
			]),
		});
		const dialog = await openEdit("posts");
		const key = keyField(dialog);
		const user = userEvent.setup();
		await user.clear(key);
		await user.type(key, "authorId");
		await user.click(within(dialog).getByRole("button", { name: "Update" }));
		expect(
			await within(dialog).findByText(
				"This parent key can't be used. Pick another name.",
			),
		).toBeInTheDocument();
		expect(key).toHaveAttribute("aria-invalid", "true");
		await waitFor(() => expect(key).toHaveFocus());
		await user.type(key, "2");
		expect(key).not.toHaveAttribute("aria-invalid");
	});

	it("has no Parent key on a root resource or a new one", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		});
		const dialog = await openEdit("users");
		expect(
			within(dialog).queryByRole("textbox", { name: /^Parent key/ }),
		).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Cancel" }),
		);
		const created = await openNewResource();
		expect(
			within(created).queryByRole("textbox", { name: /^Parent key/ }),
		).toBeNull();
	});
});
