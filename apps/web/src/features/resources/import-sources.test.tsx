import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRecord } from "../../lib/json-guards";
import { apiError } from "../../pages/project-detail/project-detail-test-helpers";
import { seriousViolations } from "../../test/axe";
import { setEditorText } from "../../test/code-mirror";
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

const PETSTORE = '{"openapi":"3.0.3","components":{"schemas":{}}}';
const generated = (name: string) =>
	importedJson(name, { sampleKind: "generated" });

describe("Import sources, errors and plan room", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("previews another OpenAPI schema when it is picked", async () => {
		const { dialog, calls } = await openImport(
			importRoute((call) => {
				const schema =
					isRecord(call.body) && typeof call.body.schema === "string"
						? call.body.schema
						: "Pet";
				return {
					body: importJson({
						resources: [generated(schema.toLowerCase())],
						schemaNames: ["Pet", "Category"],
						selectedSchema: schema,
					}),
				};
			}),
		);
		await userEvent.click(within(dialog).getByRole("tab", { name: "OpenAPI" }));
		setEditorText(importTab(dialog, "openapi"), PETSTORE);
		await previewReady();
		expect(
			within(dialog).getByRole("heading", {
				name: "Sample records generated from the schema",
			}),
		).toBeInTheDocument();
		expect(
			within(dialog).getByText(/The resource starts empty/),
		).toBeInTheDocument();
		const schema = within(dialog).getByRole("combobox", { name: "Schema" });
		expect(schema).toHaveValue("Pet");
		await userEvent.selectOptions(schema, "Category");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("textbox", { name: /Resource name/ }),
			).toHaveValue("category"),
		);
		expect(importCalls(calls, true).map((call) => call.body)).toMatchObject([
			{ format: "openapi", includeRelated: true },
			{ format: "openapi", schema: "Category" },
		]);
	});

	it("explains import errors by their code, never the parser's text", async () => {
		const replies = [
			apiError(400, "SCHEMA_IMPORT_FAILED", {
				reason: "REF_CYCLE",
				cycle: "Pet → Owner → Pet",
			}),
			apiError(400, "SCHEMA_IMPORT_FAILED", {
				reason: "EXTERNAL_REF",
				ref: "https://x.test/a.json",
			}),
			apiError(413, "SCHEMA_IMPORT_FAILED", {
				reason: "INPUT_TOO_LARGE",
				max: 5 * 1024 * 1024,
			}),
		];
		const { dialog } = await openImport(
			importRoute(() => replies.shift() ?? { body: importJson() }),
		);
		await userEvent.click(within(dialog).getByRole("tab", { name: "OpenAPI" }));
		setEditorText(importTab(dialog, "openapi"), PETSTORE);
		const alert = await within(dialog).findByRole(
			"alert",
			{},
			{ timeout: 3000 },
		);
		expect(alert).toHaveTextContent(
			"These schemas refer to each other in a loop: Pet → Owner → Pet.",
		);
		expect(
			within(dialog).getByRole("button", { name: "Create resource" }),
		).toBeDisabled();
		setEditorText(importTab(dialog, "openapi"), `${PETSTORE} `);
		await waitFor(
			() =>
				expect(within(dialog).getByRole("alert")).toHaveTextContent(
					"https://x.test/a.json points outside this document.",
				),
			{ timeout: 3000 },
		);
		setEditorText(importTab(dialog, "openapi"), `${PETSTORE}  `);
		await waitFor(
			() =>
				expect(within(dialog).getByRole("alert")).toHaveTextContent(
					"The source is over 5 MB.",
				),
			{ timeout: 3000 },
		);
	});

	it("reads a CSV or JSON file of at most 5 MB, named after the file", async () => {
		const user = userEvent.setup({ applyAccept: false });
		const { dialog, calls } = await openImport(
			importRoute(() => ({ body: importJson() })),
		);
		await user.click(
			within(dialog).getByRole("tab", { name: "CSV or JSON file" }),
		);
		const input = () =>
			importTab(dialog, "file").querySelector<HTMLInputElement>(
				'input[type="file"]',
			);
		const pick = async (file: File) => {
			const element = input();
			if (!element) throw new Error("no file input");
			await user.upload(element, file);
		};
		await pick(new File(["x"], "notes.txt"));
		expect(within(dialog).getByRole("alert")).toHaveTextContent(
			"Choose a .csv or .json file.",
		);
		await pick(new File([new Uint8Array(6 * 1024 * 1024)], "big.csv"));
		expect(within(dialog).getByRole("alert")).toHaveTextContent(
			"The file is 6,144 KB, over the 5 MB limit.",
		);
		await pick(
			new File(["name,age\nAda,36\n"], "Users List.csv", { type: "text/csv" }),
		);
		await previewReady();
		expect(
			within(dialog).getByText("Users List.csv · 0.1 KB"),
		).toBeInTheDocument();
		expect(importCalls(calls, true)[0]?.body).toEqual({
			format: "csv",
			input: "name,age\nAda,36\n",
			name: "users-list",
		});
		await user.click(
			within(dialog).getByRole("button", { name: "Remove file" }),
		);
		expect(
			within(dialog).getByText("Choose a CSV or JSON file"),
		).toBeInTheDocument();
	});

	it("blocks the import when the project has no room", async () => {
		const { dialog } = await openImport(
			importRoute(() => ({ body: importJson({ resourcesLeft: 0 }) })),
		);
		setEditorText(importTab(dialog, "json"), SAMPLE_JSON);
		await previewReady();
		const room = within(dialog).getByText(/room for 0 more/);
		expect(room.closest('[role="alert"]')).not.toHaveTextContent(/plan/i);
		expect(within(dialog).queryByRole("button", { name: /plan/i })).toBeNull();
		expect(
			within(dialog).getByRole("button", { name: "Create resource" }),
		).toBeDisabled();
		expect(await seriousViolations(dialog)).toEqual([]);
	});
});
