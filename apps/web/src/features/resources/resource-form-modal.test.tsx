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
		const name = within(dialog).getByLabelText(/Tên resource/);
		await waitFor(() => expect(name).toHaveFocus());
		await userEvent.type(name, "orders");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Tạo resource" }),
		);
		expect(await findToast("Đã tạo resource orders.")).toBeInTheDocument();
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
			within(dialog).getByLabelText(/Tên resource/),
			"likes",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Thêm field" }),
		);
		await userEvent.type(
			within(dialog).getByRole("textbox", { name: "Tên field 4" }),
			"id",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Tạo resource" }),
		);
		expect(
			within(dialog).getByText("Đã có resource cùng tên ở vị trí này."),
		).toBeInTheDocument();
		expect(
			within(dialog).getByText("Field “id” được sinh tự động."),
		).toBeInTheDocument();
		expect(calls.some((c) => c.method === "POST")).toBe(false);
	});

	it("opens the plan dialog when the resource quota is used up", async () => {
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
			within(dialog).getByLabelText(/Tên resource/),
			"orders",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Tạo resource" }),
		);
		const plans = await screen.findByRole("dialog", { name: "Quản lý gói" });
		expect(plans).toHaveTextContent(
			"Bạn đã đạt giới hạn gói Free: 10 resource",
		);
		expect(screen.queryByRole("dialog", { name: "Resource mới" })).toBeNull();
	});

	it("explains API refusals in Vietnamese", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${RESOURCES_PATH}`]: apiError(400, "TEMPLATE_TOO_LARGE"),
		});
		const dialog = await openNewResource();
		await userEvent.type(
			within(dialog).getByLabelText(/Tên resource/),
			"orders",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Tạo resource" }),
		);
		expect(
			await within(dialog).findByText(
				"Object template có thể sinh bản ghi lớn hơn 32 KB. Hãy rút gọn template.",
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
			within(node).getByRole("button", { name: "Sửa comments" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Sửa resource · comments",
		});
		expect(
			within(dialog).getByRole("textbox", { name: "Field id" }),
		).toBeDisabled();
		expect(
			within(dialog).getByRole("textbox", { name: "Field postId" }),
		).toHaveValue("postId");
		const type = within(dialog).getByRole("combobox", {
			name: "Kiểu dữ liệu của name",
		});
		const options = within(type)
			.getAllByRole("option")
			.map((o) => o.textContent);
		expect(options).toContain("Parent Resource");
		expect(options).not.toContain("Child Resource");
		await userEvent.selectOptions(type, "Parent Resource");
		expect(
			within(dialog).getByRole("textbox", {
				name: "Kiểu này không cần method (name)",
			}),
		).toHaveValue("posts");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Cập nhật" }),
		);
		expect(
			await findToast("Đã cập nhật resource comments."),
		).toBeInTheDocument();
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
				"Object template phải là một object JSON.",
			),
		).toBeInTheDocument();
	});
});
