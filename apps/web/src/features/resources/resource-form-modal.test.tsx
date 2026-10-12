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
import {} from "../../pages/projects/projects-test-helpers";
import { blurEditor, setEditorText } from "../../test/code-mirror";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";

describe("Resource form", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("creates a root resource with the default schema and endpoints", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${RESOURCES_PATH}`]: { status: 201, body: resourceJson("orders") },
		});
		const dialog = await openNewResource();
		const name = within(dialog).getByLabelText(/Resource name/);
		await waitFor(() => expect(name).toHaveFocus());
		await userEvent.type(name, "orders");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create resource" }),
		);
		expect(await findToast("Created resource orders.")).toBeInTheDocument();
		const body = calls.find((c) => c.method === "POST")?.body;
		expect(body).toMatchObject({
			name: "orders",
			parentId: null,
			template: null,
			schema: [
				{ name: "createdAt", type: "Faker.js", fakerMethod: "date.past" },
				{ name: "name", type: "Faker.js", fakerMethod: "name.fullName" },
				{ name: "avatar", type: "Faker.js", fakerMethod: "image.avatar" },
			],
		});
		expect((body as { endpoints: unknown[] }).endpoints).toHaveLength(5);
		expect(
			calls.filter((c) => c.path === RESOURCES_PATH && c.method === "GET"),
		).toHaveLength(2);
	});

	it("checks names and reserved fields before sending", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		});
		const dialog = await openNewResource();
		await userEvent.type(
			within(dialog).getByLabelText(/Resource name/),
			"likes",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Add field" }),
		);
		await userEvent.type(
			within(dialog).getByRole("textbox", { name: "Field name 4" }),
			"id",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create resource" }),
		);
		expect(
			within(dialog).getByText(
				"There's already a resource with this name here.",
			),
		).toBeInTheDocument();
		expect(
			within(dialog).getByText("Field “id” is generated automatically."),
		).toBeInTheDocument();
		expect(calls.some((c) => c.method === "POST")).toBe(false);
	});

	it("names the resource limit when the quota is used up", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${RESOURCES_PATH}`]: apiError(403, "PLAN_LIMIT_REACHED", {
				limit: "resources",
				max: 10,
				used: 10,
			}),
		});
		const dialog = await openNewResource();
		await userEvent.type(
			within(dialog).getByLabelText(/Resource name/),
			"orders",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create resource" }),
		);
		const notice = await findToast(
			"Your projects have reached their limit of 10 resources in total.",
		);
		expect(notice).toHaveTextContent("Tell us with the feedback form.");
		expect(notice).not.toHaveTextContent(/plan|Pro/);
		expect(document.querySelector('[data-id="modal-subscription"]')).toBeNull();
		expect(screen.queryByRole("dialog", { name: "New resource" })).toBeNull();
	});

	it("explains API refusals in Vietnamese", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${RESOURCES_PATH}`]: apiError(400, "TEMPLATE_TOO_LARGE"),
		});
		const dialog = await openNewResource();
		await userEvent.type(
			within(dialog).getByLabelText(/Resource name/),
			"orders",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create resource" }),
		);
		expect(
			await within(dialog).findByText(
				"The object template could produce records larger than 32 KB. Shorten the template.",
			),
		).toBeInTheDocument();
	});

	it("locks id and the parent id of a nested resource and offers Parent Resource", async () => {
		const { calls } = renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`PUT ${RESOURCES_PATH}/comments`]: { body: resourceJson("comments") },
		});
		const node = await findNode("comments");
		await userEvent.click(
			within(node).getByRole("button", { name: "Edit comments" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Edit resource · comments",
		});
		expect(
			within(dialog).getByRole("textbox", { name: "Field id" }),
		).toBeDisabled();
		expect(
			within(dialog).getByRole("textbox", { name: "Field postId" }),
		).toHaveValue("postId");
		const type = within(dialog).getByRole("combobox", {
			name: "Data type of name",
		});
		const options = within(type)
			.getAllByRole("option")
			.map((o) => o.textContent);
		expect(options).toContain("Parent Resource");
		expect(options).not.toContain("Child Resource");
		await userEvent.selectOptions(type, "Parent Resource");
		expect(
			within(dialog).getByRole("textbox", {
				name: "This type needs no method (name)",
			}),
		).toHaveValue("posts");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Update" }),
		);
		expect(await findToast("Updated resource comments.")).toBeInTheDocument();
		const put = calls.find((c) => c.method === "PUT")?.body;
		expect(put).not.toHaveProperty("parentId");
		expect(put).toMatchObject({
			schema: [{ name: "name", type: "Parent Resource" }],
		});
	});

	it("rejects an object template that is not a JSON object", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		});
		const dialog = await openNewResource();
		const template = dialog.querySelector(
			'[data-id="resource-form-template-json"]',
		);
		if (!template) throw new Error("no template editor");
		setEditorText(template, "[1]");
		blurEditor(template);
		expect(
			await within(dialog).findByText(
				"The object template must be a JSON object.",
			),
		).toBeInTheDocument();
	});
});
