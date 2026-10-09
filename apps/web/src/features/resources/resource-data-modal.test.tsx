import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	RESOURCES_PATH,
	apiError,
	bar,
	change,
	findNode,
	renderDetail,
	sampleTree,
} from "../../pages/project-detail/project-detail-test-helpers";
import { blurEditor, editorText, setEditorText } from "../../test/code-mirror";
import { resetCurrentUserCache } from "../auth/use-current-user";
import { checkRecords } from "./resource-data-modal";

const RECORDS = [
	{ id: "1", name: "An" },
	{ id: "2", name: "Bình" },
];

async function openData(routes: Parameters<typeof renderDetail>[0] = {}) {
	const api = renderDetail({
		[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		[`GET ${RESOURCES_PATH}/users/data`]: {
			body: { resourceId: "users", parentKey: null, count: 2, data: RECORDS },
		},
		...routes,
	});
	const node = await findNode("users");
	await userEvent.click(
		within(node).getByRole("button", { name: "Dữ liệu users" }),
	);
	const dialog = await screen.findByRole("dialog", { name: "Dữ liệu · users" });
	const editor = await within(dialog).findByRole("textbox", {
		name: "Dữ liệu JSON của users",
	});
	const frame = editor.closest('[data-id="modal-resource-data-json"]');
	if (!frame) throw new Error("no data editor");
	const update = within(dialog).getByRole("button", { name: "Cập nhật" });
	return { ...api, dialog, frame, update };
}

describe("Resource data modal", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("enables Update only for a changed, valid array of objects", async () => {
		const { dialog, frame, update } = await openData();
		expect(editorText(frame)).toBe(JSON.stringify(RECORDS, null, 2));
		expect(update).toBeDisabled();
		setEditorText(frame, "[{");
		expect(update).toBeDisabled();
		blurEditor(frame);
		expect(
			await within(dialog).findByText(/JSON không hợp lệ ở dòng 1/),
		).toBeInTheDocument();
		setEditorText(frame, '{"id": "1"}');
		blurEditor(frame);
		expect(
			await within(dialog).findByText("Dữ liệu phải là một mảng JSON."),
		).toBeInTheDocument();
		expect(update).toBeDisabled();
		setEditorText(frame, JSON.stringify(RECORDS, null, 2));
		expect(update).toBeDisabled();
		setEditorText(frame, '[{"name": "Chi"}]');
		// Checked after a short pause in typing.
		expect(update).toBeDisabled();
		await waitFor(() => expect(update).toBeEnabled());
	});

	it("replaces the data and updates the count", async () => {
		const { calls, frame, update } = await openData({
			[`PUT ${RESOURCES_PATH}/users/data`]: {
				body: {
					dryRun: false,
					changes: [change("users", 10, 1), change("posts", 0, 0)],
				},
			},
		});
		setEditorText(frame, '[{"name": "Chi"}]');
		await waitFor(() => expect(update).toBeEnabled());
		await userEvent.click(update);
		expect(await screen.findByText("Đã cập nhật dữ liệu")).toBeInTheDocument();
		expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
			data: [{ name: "Chi" }],
		});
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(bar(await findNode("users"))).toHaveAttribute("aria-valuenow", "1");
	});

	it("keeps the modal open with the reason when the API refuses", async () => {
		const { dialog, frame, update } = await openData({
			[`PUT ${RESOURCES_PATH}/users/data`]: apiError(413, "DATA_TOO_LARGE", {
				limit: "record",
				name: "users",
			}),
		});
		setEditorText(frame, '[{"name": "Chi"}]');
		await waitFor(() => expect(update).toBeEnabled());
		await userEvent.click(update);
		expect(
			await within(dialog).findByText(
				"Dữ liệu của users có bản ghi vượt 32 KB. Hãy rút gọn bản ghi hoặc template.",
			),
		).toBeInTheDocument();
	});
});

describe("Resource data modal and child data", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("asks before new data drops the records of a child resource", async () => {
		const items = sampleTree().map((r) =>
			r.id === "posts" ? { ...r, count: 40 } : r,
		);
		const { calls, frame, update } = await openData({
			[`GET ${RESOURCES_PATH}`]: { body: { items } },
			[`PUT ${RESOURCES_PATH}/users/data`]: ({ query }) => ({
				body: {
					dryRun: query.get("dryRun") === "true",
					changes: [change("users", 2, 0), change("posts", 40, 0)],
				},
			}),
		});
		setEditorText(frame, "[]");
		await waitFor(() => expect(update).toBeEnabled());
		await userEvent.click(update);
		const confirm = await screen.findByRole("dialog", {
			name: "Cập nhật dữ liệu",
		});
		expect(within(confirm).getByRole("list")).toHaveTextContent(
			"posts: 40 → 0 bản ghi",
		);
		const puts = () => calls.filter((c) => c.method === "PUT");
		expect(puts().map((c) => c.query.get("dryRun"))).toEqual(["true"]);
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Cập nhật" }),
		);
		expect(await screen.findByText("Đã cập nhật dữ liệu")).toBeInTheDocument();
		expect(puts().map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
		expect(puts()[1]?.body).toEqual({ data: [] });
	});
});

describe("checkRecords", () => {
	it("accepts up to 1000 objects and refuses anything else", () => {
		expect(checkRecords("[]")).toEqual({ records: [], error: null });
		expect(checkRecords("[1]").error).toBe(
			"Mỗi phần tử phải là một object JSON.",
		);
		expect(checkRecords("[[]]").error).toBe(
			"Mỗi phần tử phải là một object JSON.",
		);
		const many = JSON.stringify(Array.from({ length: 1001 }, () => ({})));
		expect(checkRecords(many).error).toBe(
			"Tối đa 1000 bản ghi (đang có 1001).",
		);
		expect(checkRecords("nope").error).toBe("JSON không hợp lệ.");
	});
});
