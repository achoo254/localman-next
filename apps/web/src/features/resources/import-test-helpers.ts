import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ALL_FEATURES } from "../../pages/landing/landing-test-helpers";
import {
	RESOURCES_PATH,
	findNode,
	renderDetail,
	sampleTree,
} from "../../pages/project-detail/project-detail-test-helpers";
import type { Project } from "../../pages/projects/projects-api";
import type { FetchCall, MockReply, MockRoute } from "../../test/mock-fetch";

export const IMPORT_PATH = `${RESOURCES_PATH}/import`;

/** A resource of an import preview; `name` doubles as its `key`. */
export function importedJson(
	name: string,
	overrides: Record<string, unknown> = {},
) {
	return {
		key: name,
		name,
		parentName: null,
		fields: [
			{
				name: "name",
				type: "Faker.js",
				fakerMethod: "name.fullName",
				suggested: true,
			},
			{ name: "age", type: "Number", suggested: false },
		],
		sample: [
			{ id: "1", name: "Ada", age: 36 },
			{ id: "2", name: "Linus", age: 54, tags: ["a", "b"] },
		],
		sampleKind: "source",
		recordCount: 3,
		truncated: false,
		...overrides,
	};
}

/** Body of `POST …/resources/import`, dry run or not. */
export function importJson(overrides: Record<string, unknown> = {}) {
	return {
		dryRun: true,
		resources: [importedJson("items")],
		warnings: [],
		schemaNames: [],
		selectedSchema: null,
		relatedCount: 0,
		resourcesLeft: null,
		created: [],
		uiUrl: "https://localman.test/projects/p1",
		...overrides,
	};
}

/** Answers previews with `preview` and the create call with `create`. */
export function importRoute(
	preview: (call: FetchCall) => MockReply,
	create: MockReply = { status: 201, body: importJson({ dryRun: false }) },
): MockRoute {
	return (call) =>
		call.query.get("dryRun") === "true" ? preview(call) : create;
}

/** Opens "Import resource" from the endpoint card of the sample tree. */
export async function openImport(route: MockRoute, project?: Project) {
	const view = renderDetail(
		{
			[`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } },
			[`POST ${IMPORT_PATH}`]: route,
		},
		project,
		{ flags: ALL_FEATURES },
	);
	await findNode("users");
	await userEvent.click(screen.getByRole("button", { name: "Import" }));
	const dialog = await screen.findByRole("dialog", { name: "Import resource" });
	return { ...view, dialog };
}

/** Calls to the import route, dry runs or creates. */
export function importCalls(calls: FetchCall[], dryRun: boolean): FetchCall[] {
	return calls.filter(
		(call) =>
			call.path === IMPORT_PATH &&
			(call.query.get("dryRun") === "true") === dryRun,
	);
}

/** Waits past the preview debounce for the preview to show. */
export function previewReady(): Promise<void> {
	return waitFor(
		() => {
			if (!screen.queryByText(/^Preview ready/)?.textContent) {
				throw new Error("no preview yet");
			}
		},
		{ timeout: 3000 },
	);
}

export const SAMPLE_JSON =
	'[{"name":"Ada","age":36},{"name":"Linus","age":54},{"name":"Grace","age":45}]';

/** The tab panel holding the editor (or file drop) of `tab`. */
export function importTab(dialog: HTMLElement, tab: string): HTMLElement {
	const frame = dialog.querySelector<HTMLElement>(
		`[data-id="resource-import-${tab}"]`,
	);
	if (!frame) throw new Error(`no ${tab} tab`);
	return frame;
}
