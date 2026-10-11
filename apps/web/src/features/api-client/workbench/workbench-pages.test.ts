import { createRequestDraft } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import type { WorkbenchAction } from "./workbench-action";
import {
	INITIAL_WORKBENCH,
	type WorkbenchState,
	workbenchReducer,
} from "./workbench-reducer";
import type { PageTab } from "./workbench-tab-types";

const run = (...actions: WorkbenchAction[]): WorkbenchState =>
	actions.reduce(workbenchReducer, INITIAL_WORKBENCH);

const SAVED = createRequestDraft({ name: "List", url: "https://a.test" });
const SOURCE = { collectionId: "c1", nodeId: "r1" };
const page = (id: string): PageTab => ({
	id,
	kind: "collection",
	collectionId: id,
	nodeId: null,
	name: `Page ${id}`,
});
const open = (id: string, saved?: typeof SAVED): WorkbenchAction => ({
	type: "open",
	id,
	draft: SAVED,
	files: new Map(),
	activate: true,
	redacted: false,
	...(saved ? { source: SOURCE, saved } : {}),
});

describe("workbench pages and bound tabs", () => {
	it("opens a page once, after the requests, and closes to a neighbour", () => {
		let state = run(open("a"), { type: "openPage", page: page("p1") });
		state = workbenchReducer(state, { type: "openPage", page: page("p1") });
		expect(state.pages.map((p) => p.id)).toEqual(["p1"]);
		expect(state.activeTabId).toBe("p1");
		state = workbenchReducer(state, { type: "close", id: "p1" });
		expect(state.activeTabId).toBe("a");
	});

	it("is clean while a bound tab matches its saved request", () => {
		let state = run(open("a", SAVED));
		expect(state.tabs[0]).toMatchObject({ source: SOURCE, dirty: false });
		const edit = (url: string): WorkbenchAction => ({
			type: "editDraft",
			id: "a",
			update: (draft) => ({ ...draft, url }),
		});
		state = workbenchReducer(state, edit("https://b.test"));
		expect(state.tabs[0]?.dirty).toBe(true);
		// Typing the saved value back makes it clean again.
		state = workbenchReducer(state, edit("https://a.test"));
		expect(state.tabs[0]?.dirty).toBe(false);
	});

	it("turns clean when saved and dirty again once unbound", () => {
		let state = run(open("a"), {
			type: "editDraft",
			id: "a",
			update: (draft) => ({ ...draft, url: "https://c.test" }),
		});
		expect(state.tabs[0]?.dirty).toBe(true);
		const draft = state.tabs[0]?.draft ?? SAVED;
		state = workbenchReducer(state, {
			type: "bind",
			id: "a",
			source: SOURCE,
			saved: draft,
		});
		expect(state.tabs[0]?.dirty).toBe(false);
		state = workbenchReducer(state, {
			type: "bind",
			id: "a",
			source: null,
			saved: null,
		});
		expect(state.tabs[0]).toMatchObject({ source: null, dirty: true });
	});

	it("keeps the binding of restored tabs until their saved draft is known", () => {
		let state = run({
			type: "restore",
			tabs: [{ id: "a", draft: SAVED, source: SOURCE }],
		});
		expect(state.tabs[0]).toMatchObject({ source: SOURCE, saved: null });
		state = workbenchReducer(state, {
			type: "setSaved",
			id: "a",
			saved: SAVED,
		});
		expect(state.tabs[0]?.dirty).toBe(false);
	});
});
