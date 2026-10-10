import { createRequestDraft } from "@localman/shared/api-client";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { editorText, setEditorText } from "../../../test/code-mirror";
import {
	byDataId,
	echoSender,
	renderWorkbench,
	stubClientApi,
} from "../workbench/workbench-test-utils";
import type { SendInput } from "../workbench/workbench-types";

afterEach(() => vi.unstubAllGlobals());

/** Opens one POST tab on its Body pane; the sender keeps what it was given. */
async function openBody() {
	const inputs: SendInput[] = [];
	const echo = echoSender();
	const sender = Object.assign(
		async (input: SendInput) => {
			inputs.push(input);
			return echo(input);
		},
		{ drafts: echo.drafts },
	);
	stubClientApi([
		{
			tabId: "t1",
			draft: createRequestDraft({ method: "POST", url: "https://a.test/up" }),
		},
	]);
	renderWorkbench({ sender });
	await screen.findByRole("tablist", { name: "Open requests" });
	const user = userEvent.setup();
	await user.click(byDataId("request-tab-body"));
	const send = async () => {
		await user.click(byDataId("request-send"));
		await screen.findByText(/^echo POST/);
		return inputs.at(-1);
	};
	return { user, send };
}

describe("Request body", () => {
	it("edits a raw body with its language", async () => {
		const { user, send } = await openBody();
		expect(screen.getByText("This request has no body.")).toBeInTheDocument();
		await user.click(byDataId("request-body-type-raw"));
		await user.selectOptions(byDataId("request-body-raw-lang"), "xml");
		setEditorText(byDataId("request-body-editor"), "<a>1</a>");
		expect(editorText(byDataId("request-body-editor"))).toBe("<a>1</a>");
		expect(byDataId("request-body-editor")).toHaveAttribute(
			"data-language",
			"xml",
		);
		const sent = await send();
		expect(sent?.draft.body).toMatchObject({
			type: "raw",
			rawLanguage: "xml",
			raw: "<a>1</a>",
		});
	});

	it("keeps url-encoded rows and each kind's content when switching", async () => {
		const { user, send } = await openBody();
		await user.click(byDataId("request-body-type-urlencoded"));
		await user.click(byDataId("request-body-add"));
		const table = within(byDataId("request-body-urlencoded"));
		// The new row takes focus after it renders.
		await waitFor(() =>
			expect(
				table.getByRole("textbox", { name: "Key of row 1" }),
			).toHaveFocus(),
		);
		fireEvent.change(table.getByRole("textbox", { name: "Key of row 1" }), {
			target: { value: "name" },
		});
		fireEvent.change(table.getByRole("textbox", { name: "Value of name" }), {
			target: { value: "An" },
		});
		await user.click(byDataId("request-body-type-none"));
		await user.click(byDataId("request-body-type-urlencoded"));
		expect(
			within(byDataId("request-body-urlencoded")).getByRole("textbox", {
				name: "Value of name",
			}),
		).toHaveValue("An");
		const sent = await send();
		expect(sent?.draft.body.urlencoded).toEqual([
			expect.objectContaining({ key: "name", value: "An", enabled: true }),
		]);
	});

	it("attaches files to form-data rows and to a binary body", async () => {
		const { user, send } = await openBody();
		await user.click(byDataId("request-body-type-formdata"));
		await user.click(byDataId("request-body-add"));
		const table = within(byDataId("request-body-formData"));
		fireEvent.change(table.getByRole("textbox", { name: "Key of row 1" }), {
			target: { value: "avatar" },
		});
		await user.selectOptions(
			table.getByRole("combobox", { name: "Type of avatar" }),
			"file",
		);
		const photo = new File(["png"], "me.png", { type: "image/png" });
		await user.upload(table.getByLabelText("File of avatar"), photo);
		expect(table.getByText("me.png")).toBeInTheDocument();
		let sent = await send();
		const row = sent?.draft.body.formData[0];
		expect(row).toMatchObject({
			key: "avatar",
			kind: "file",
			file: { name: "me.png", contentType: "image/png", size: 3 },
		});
		expect(row?.file && sent?.files.get(row.file.fileId)).toBe(photo);

		await user.click(byDataId("request-body-type-binary"));
		const blob = new File([new Uint8Array([1, 2])], "data.bin");
		await user.upload(screen.getByLabelText("Body file"), blob);
		expect(screen.getByText("2 bytes")).toBeInTheDocument();
		sent = await send();
		const binary = sent?.draft.body.binary;
		expect(binary?.name).toBe("data.bin");
		expect(binary && sent?.files.get(binary.fileId)).toBe(blob);
	});

	it("refuses files over 10 MB and warns that GET carries no body", async () => {
		const { user } = await openBody();
		await user.click(byDataId("request-body-type-binary"));
		const huge = new File(["x"], "huge.bin");
		Object.defineProperty(huge, "size", { value: 11 * 1024 * 1024 });
		await user.upload(screen.getByLabelText("Body file"), huge);
		expect(screen.getByRole("alert")).toHaveTextContent("over 10 MB");
		await user.selectOptions(byDataId("request-method"), "GET");
		await waitFor(() =>
			expect(
				screen.getByText("GET requests are sent without a body."),
			).toBeInTheDocument(),
		);
	});
});
