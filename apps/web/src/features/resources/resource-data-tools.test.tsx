import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	RESOURCES_PATH,
	findNode,
	renderDetail,
	sampleTree,
} from "../../pages/project-detail/project-detail-test-helpers";
import { seriousViolations } from "../../test/axe";
import { editorView, setEditorText } from "../../test/code-mirror";
import { resetCurrentUserCache } from "../auth/use-current-user";
import { arrayElementOffset } from "./record-position";
import { ResourceModalTitle } from "./resource-modal-title";

const RECORDS = [
	{ id: "1", name: "An" },
	{ id: 2, name: "Bình" },
	{ id: "u-3", name: "Chi" },
];

async function openData() {
	renderDetail({
		[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
		[`GET ${RESOURCES_PATH}/users/data`]: {
			body: { resourceId: "users", parentKey: null, count: 3, data: RECORDS },
		},
	});
	await userEvent.click(
		within(await findNode("users")).getByRole("button", {
			name: "Data of users",
		}),
	);
	const dialog = await screen.findByRole("dialog", { name: "Data · users" });
	await within(dialog).findByRole("textbox", { name: "JSON data of users" });
	const frame = dialog.querySelector('[data-id="modal-resource-data-json"]');
	if (!frame) throw new Error("no data editor");
	return { dialog, frame };
}

describe("Data modal tools", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("counts the records in the editor", async () => {
		const { dialog, frame } = await openData();
		const count = within(dialog).getByText("3 records");
		setEditorText(frame, '[{"id": "1"}]');
		await waitFor(() => expect(count).toHaveTextContent("1 record"));
	});

	it("moves the cursor to the record with the id, or says it is missing", async () => {
		const { dialog, frame } = await openData();
		const goTo = within(dialog).getByRole("textbox", { name: "Go to id" });
		const user = userEvent.setup();
		await user.type(goTo, "u-3");
		await user.click(within(dialog).getByRole("button", { name: "Go" }));
		const view = editorView(frame);
		const text = view.state.doc.toString();
		expect(view.state.selection.main.head).toBe(arrayElementOffset(text, 2));

		await user.clear(goTo);
		await user.type(goTo, "2{Enter}");
		expect(view.state.selection.main.head).toBe(arrayElementOffset(text, 1));

		await user.clear(goTo);
		await user.type(goTo, "404{Enter}");
		expect(
			within(dialog).getByText("No record has the id “404”."),
		).toBeInTheDocument();
		expect(goTo).toHaveAttribute("aria-invalid", "true");
		await user.type(goTo, "0");
		expect(goTo).not.toHaveAttribute("aria-invalid");

		setEditorText(frame, "[{");
		await user.type(goTo, "{Enter}");
		expect(
			within(dialog).getByText("Fix the JSON first, then search by id."),
		).toBeInTheDocument();
	});

	it("switches line wrapping", async () => {
		const { dialog, frame } = await openData();
		const wrap = within(dialog).getByRole("button", { name: "Wrap lines" });
		const content = frame.querySelector(".cm-content");
		expect(wrap).toHaveAttribute("aria-pressed", "false");
		expect(content).not.toHaveClass("cm-lineWrapping");
		await userEvent.click(wrap);
		expect(wrap).toHaveAttribute("aria-pressed", "true");
		expect(content).toHaveClass("cm-lineWrapping");
		await userEvent.click(wrap);
		expect(content).not.toHaveClass("cm-lineWrapping");
	});

	it("lets keyboard users reach the scroll area, with no serious axe issue", async () => {
		const { dialog } = await openData();
		const scroller = within(dialog).getByRole("region", {
			name: "Scrollable JSON data of users",
		});
		expect(scroller).toHaveClass("cm-scroller");
		expect(scroller).toHaveAttribute("tabindex", "0");
		expect(await seriousViolations(dialog)).toEqual([]);
	});
});

describe("ResourceModalTitle", () => {
	it("cuts a long name in the middle and keeps the full name readable", () => {
		const name = "customer-relationship-management-contacts-name-01";
		render(
			<h2>
				<ResourceModalTitle text={`Edit resource · <name>${name}</name>`} />
			</h2>,
		);
		const heading = screen.getByRole("heading");
		expect(heading).toHaveTextContent(`Edit resource · ${name}`);
		const full = within(heading).getByTitle(name);
		expect(full.lastElementChild).toHaveTextContent("-name-01");
		expect(full.firstElementChild).toHaveClass("truncate");
	});
});
