import {
	DRAFT_MAX_TABS,
	createRequestDraft,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import type { WorkbenchAction } from "./workbench-action";
import {
	INITIAL_WORKBENCH,
	type WorkbenchState,
	isBlankDraft,
	workbenchReducer,
} from "./workbench-reducer";

const NO_FILES = new Map<string, File>();

function run(...actions: WorkbenchAction[]): WorkbenchState {
	return actions.reduce(workbenchReducer, INITIAL_WORKBENCH);
}

const open = (id: string, url = ""): WorkbenchAction => ({
	type: "open",
	id,
	draft: createRequestDraft({ url }),
	files: NO_FILES,
	activate: true,
	redacted: false,
});

describe("workbenchReducer", () => {
	it("opens tabs at the end and activates the new one", () => {
		const state = run(open("a"), open("b"));
		expect(state.tabs.map((tab) => tab.id)).toEqual(["a", "b"]);
		expect(state.activeTabId).toBe("b");
		expect(state.tabs[0]?.dirty).toBe(false);
		expect(state.tabs[0]?.response).toEqual({ kind: "idle" });
	});

	it("keeps the active tab when opening in the background", () => {
		const state = run(open("a"), {
			...open("b"),
			activate: false,
		} as WorkbenchAction);
		expect(state.activeTabId).toBe("a");
	});

	it("activates the right neighbour, else the left one, when the active tab closes", () => {
		let state = run(open("a"), open("b"), open("c"), {
			type: "activate",
			id: "b",
		});
		state = workbenchReducer(state, { type: "close", id: "b" });
		expect(state.activeTabId).toBe("c");
		state = workbenchReducer(state, { type: "close", id: "c" });
		expect(state.activeTabId).toBe("a");
		state = workbenchReducer(state, { type: "close", id: "a" });
		expect(state).toEqual({ tabs: [], pages: [], activeTabId: null });
	});

	it("closes several tabs at once, the nearest kept one taking over", () => {
		let state = run(open("a"), open("b"), open("c"), open("d"), {
			type: "activate",
			id: "b",
		});
		state = workbenchReducer(state, { type: "closeMany", ids: ["b", "c"] });
		expect(state.tabs.map((tab) => tab.id)).toEqual(["a", "d"]);
		expect(state.activeTabId).toBe("d");
		state = workbenchReducer(state, { type: "closeMany", ids: ["d"] });
		expect(state.activeTabId).toBe("a");
		expect(workbenchReducer(state, { type: "closeMany", ids: ["zz"] })).toBe(
			state,
		);
	});

	it("marks a tab dirty on edit, and not when the update changes nothing", () => {
		let state = run(open("a"));
		state = workbenchReducer(state, {
			type: "editDraft",
			id: "a",
			update: (d) => d,
		});
		expect(state.tabs[0]?.dirty).toBe(false);
		state = workbenchReducer(state, {
			type: "editDraft",
			id: "a",
			update: (d) => ({ ...d, url: "https://x.test" }),
		});
		expect(state.tabs[0]?.dirty).toBe(true);
		expect(state.tabs[0]?.draft.url).toBe("https://x.test");
	});

	it("restores server tabs before tabs opened meanwhile, dirty unless blank", () => {
		const state = run(open("local"), {
			type: "restore",
			tabs: [
				{ id: "s1", draft: createRequestDraft({ url: "https://a.test" }) },
				{ id: "s2", draft: createRequestDraft() },
				{ id: "local", draft: createRequestDraft({ url: "dup" }) },
			],
		});
		expect(state.tabs.map((tab) => [tab.id, tab.dirty])).toEqual([
			["s1", true],
			["s2", false],
			["local", false],
		]);
		expect(state.activeTabId).toBe("local");
		expect(
			run({ type: "restore", tabs: [{ id: "s", draft: createRequestDraft() }] })
				.activeTabId,
		).toBe("s");
	});

	it("keeps and forgets picked files, and sets the response of one tab", () => {
		const file = new File(["x"], "a.bin");
		let state = run(open("a"), {
			type: "setFile",
			id: "a",
			fileId: "f1",
			file,
		});
		expect(state.tabs[0]?.files.get("f1")).toBe(file);
		state = workbenchReducer(state, {
			type: "setFile",
			id: "a",
			fileId: "f1",
			file: null,
		});
		expect(state.tabs[0]?.files.size).toBe(0);
		state = workbenchReducer(state, {
			type: "setResponse",
			id: "a",
			response: { kind: "sending" },
		});
		expect(state.tabs[0]?.response).toEqual({ kind: "sending" });
	});

	it("keeps the cap of open tabs when opening and when restoring", () => {
		const ids = Array.from({ length: DRAFT_MAX_TABS - 1 }, (_, i) => `t${i}`);
		let state = run(...ids.map((id) => open(id)));
		state = workbenchReducer(state, {
			type: "restore",
			tabs: [
				{ id: "s1", draft: createRequestDraft() },
				{ id: "s2", draft: createRequestDraft() },
			],
		});
		expect(state.tabs).toHaveLength(DRAFT_MAX_TABS);
		expect(state.tabs[0]?.id).toBe("s1");
		expect(workbenchReducer(state, open("over"))).toBe(state);
	});

	it("counts a route as chosen only when an edit changes it", () => {
		const proxy = createRequestDraft();
		proxy.settings.route = "proxy";
		let state = run({ ...open("a"), draft: proxy } as WorkbenchAction);
		expect(state.tabs[0]?.routeChosen).toBe(false);
		state = workbenchReducer(state, {
			type: "editDraft",
			id: "a",
			update: (d) => ({ ...d, url: "https://x.test" }),
		});
		expect(state.tabs[0]?.routeChosen).toBe(false);
		state = workbenchReducer(state, {
			type: "editDraft",
			id: "a",
			update: (d) => ({ ...d, settings: { ...d.settings, route: "auto" } }),
		});
		expect(state.tabs[0]?.routeChosen).toBe(true);
	});

	it("ignores actions on unknown tabs", () => {
		const state = run(open("a"));
		expect(workbenchReducer(state, { type: "activate", id: "zz" })).toBe(state);
		expect(workbenchReducer(state, { type: "close", id: "zz" })).toBe(state);
	});
});

describe("isBlankDraft", () => {
	it("compares by content, whatever the key order", () => {
		const blank = createRequestDraft();
		const reordered = { ...blank, settings: { ...blank.settings }, name: "" };
		expect(isBlankDraft(reordered)).toBe(true);
		expect(isBlankDraft({ ...blank, method: "POST" })).toBe(false);
	});
});
