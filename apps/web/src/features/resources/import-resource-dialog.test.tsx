import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_ID } from "../../pages/project-detail/project-detail-test-helpers";
import { setEditorText } from "../../test/code-mirror";
import { makeProject } from "../../test/fixtures";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";
import {
	SAMPLE_JSON,
	importCalls,
	importJson,
	importRoute,
	importTab,
	importedJson,
	openImport,
	previewReady,
} from "./import-test-helpers";

describe("Import resource dialog", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("previews pasted JSON, then creates it under the edited name", async () => {
		const created = importJson({
			dryRun: false,
			resources: [importedJson("people")],
		});
		const { dialog, calls } = await openImport(
			importRoute(() => ({ body: importJson() }), {
				status: 201,
				body: created,
			}),
		);
		const submit = within(dialog).getByRole("button", {
			name: "Create resource",
		});
		expect(submit).toBeDisabled();
		expect(
			within(dialog).getByText(/Paste or choose a source/),
		).toBeInTheDocument();
		setEditorText(importTab(dialog, "json"), SAMPLE_JSON);
		await previewReady();
		expect(
			screen.getByText("Preview ready: 3 fields, 3 records."),
		).toBeInTheDocument();
		const schema = within(dialog).getByRole("table", { name: "Schema" });
		expect(within(schema).getByText("name.fullName")).toBeInTheDocument();
		expect(within(schema).getByText("suggested")).toBeInTheDocument();
		const rows = within(dialog).getByRole("region", {
			name: "Records preview",
		});
		expect(within(rows).getByText("[2]")).toHaveAttribute("title", '["a","b"]');
		expect(
			within(dialog).getByRole("heading", { name: "First 2 of 3 records" }),
		).toBeInTheDocument();

		const name = within(dialog).getByRole("textbox", { name: /Resource name/ });
		await userEvent.clear(name);
		await userEvent.type(name, "users");
		expect(
			within(dialog).getByText(
				"There's already a resource with this name here.",
			),
		).toBeInTheDocument();
		expect(submit).toBeDisabled();
		await userEvent.clear(name);
		await userEvent.type(name, "people");
		await userEvent.click(submit);
		expect(
			await findToast("Imported people with 3 records."),
		).toBeInTheDocument();
		expect(importCalls(calls, true)).toHaveLength(1);
		expect(importCalls(calls, false)[0]?.body).toEqual({
			format: "json",
			input: SAMPLE_JSON,
			name: "people",
		});
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("checks the shape of a sample before asking the API", async () => {
		const { dialog, calls } = await openImport(
			importRoute(() => ({ body: importJson() })),
		);
		setEditorText(importTab(dialog, "json"), "[1, 2]");
		expect(await within(dialog).findByRole("alert")).toHaveTextContent(
			"Paste a JSON object or an array of objects.",
		);
		setEditorText(importTab(dialog, "json"), "[]");
		expect(within(dialog).getByRole("alert")).toHaveTextContent(
			"The array is empty",
		);
		expect(importCalls(calls, true)).toHaveLength(0);
	});

	it("renames related resources by key and warns when only 1,000 records fit", async () => {
		const preview = importJson({
			resources: [
				importedJson("orders", { truncated: true, recordCount: 1000 }),
				importedJson("lines", { parentName: "orders" }),
			],
			warnings: [
				{
					path: "orders.total",
					code: "MIXED_TYPES",
					params: { field: "total", types: "number, string" },
					message: "x",
				},
				{
					path: "",
					code: "SOMETHING_NEW",
					params: {},
					message: "A note from a newer API.",
				},
				{
					path: "",
					code: "TOO_MANY_RECORDS",
					params: { max: 1000 },
					message: "x",
				},
				{
					path: "",
					code: "IDS_RENUMBERED",
					params: { count: 2 },
					message: "x",
				},
			],
		});
		const { dialog, calls } = await openImport(
			importRoute(() => ({ body: preview }), {
				status: 201,
				body: { ...preview, dryRun: false },
			}),
		);
		setEditorText(importTab(dialog, "json"), SAMPLE_JSON);
		await previewReady();
		expect(
			within(dialog).getByText(
				/more than 1,000 records\. Only the first 1,000/,
			),
		).toBeInTheDocument();
		const notes = dialog.querySelector('[data-id="resource-import-warnings"]');
		expect(notes).toHaveTextContent("4 notes");
		expect(notes).toHaveTextContent(
			"total has values of several types (number, string), so it was imported as String.",
		);
		expect(notes).toHaveTextContent("A note from a newer API.");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Show all 4" }),
		);
		expect(notes).toHaveTextContent("2 records got new ids.");
		const related = within(dialog).getByRole("textbox", {
			name: "Name of related resource lines",
		});
		await userEvent.clear(related);
		await userEvent.type(related, "order-lines");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create resource" }),
		);
		await findToast("Imported orders and 1 related resource.");
		expect(importCalls(calls, false)[0]?.body).toMatchObject({
			names: { lines: "order-lines" },
		});
	});

	it("tells a collaborator how to make room, with no plans", async () => {
		const { dialog } = await openImport(
			importRoute(() => ({ body: importJson({ resourcesLeft: 0 }) })),
			makeProject(PROJECT_ID, { role: "collaborator" }),
		);
		setEditorText(importTab(dialog, "json"), SAMPLE_JSON);
		await previewReady();
		expect(
			within(dialog).getByText(/remove resources you no longer need/),
		).toBeInTheDocument();
		expect(
			within(dialog).queryByRole("button", { name: "Manage plan" }),
		).toBeNull();
	});
});
