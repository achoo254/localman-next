import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
	SuggestRequest,
	VariableAssistActions,
} from "./variable-assist-context";
import { contextAction } from "./variable-editor-assist";
import {
	classifierSource,
	variableHighlighter,
	variableMarks,
} from "./variable-highlighter";
import type { VariableKind } from "./variable-kinds";

const classify = (name: string): VariableKind =>
	name.startsWith("$")
		? "dynamic"
		: name === "baseUrl"
			? "resolved"
			: "undeclared";

function fakeActions() {
	return {
		hover: vi.fn(),
		unhover: vi.fn(),
		focusCard: vi.fn(),
		suggest: vi.fn<(request: SuggestRequest) => void>(),
		closeSuggest: vi.fn(),
		suggestKey: vi.fn(() => false),
		select: vi.fn(),
		unselect: vi.fn(),
		setAsVariable: vi.fn(),
	} satisfies VariableAssistActions;
}

let view: EditorView | null = null;
afterEach(() => {
	view?.destroy();
	view = null;
});

function editor(doc: string, actions = fakeActions()) {
	const parent = document.createElement("div");
	document.body.append(parent);
	const source = classifierSource(classify);
	view = new EditorView({
		parent,
		state: EditorState.create({
			doc,
			extensions: variableHighlighter(source, actions),
		}),
	});
	return { view, actions, source };
}

const classOf = (view: EditorView, name: string) =>
	view.contentDOM.querySelector(`[data-var="${name}"]`)?.getAttribute("class");

describe("variableMarks", () => {
	it("classifies each reference at its document offset", () => {
		expect(variableMarks("x {{baseUrl}} {{nope}}", 10, classify)).toEqual([
			{ from: 12, to: 23, name: "baseUrl", kind: "resolved" },
			{ from: 24, to: 32, name: "nope", kind: "undeclared" },
		]);
	});
});

describe("variableHighlighter", () => {
	it("colours resolved, undeclared and dynamic references", () => {
		const { view } = editor(
			'{"url": "{{baseUrl}}", "id": "{{$guid}}", "x": "{{nope}}"}',
		);
		expect(classOf(view, "baseUrl")).toContain("cm-var-resolved");
		expect(classOf(view, "$guid")).toContain("cm-var-dynamic");
		expect(classOf(view, "nope")).toContain("cm-var-undeclared");
	});

	it("offers suggestions while {{name is typed and completes the pick", () => {
		const { view, actions } = editor("GET ");
		view.dispatch({
			changes: { from: 4, insert: "{{ba" },
			selection: { anchor: 8 },
			userEvent: "input.type",
		});
		const request = actions.suggest.mock.calls.at(-1)?.[0];
		expect(request?.query).toBe("ba");
		request?.pick("baseUrl");
		expect(view.state.doc.toString()).toBe("GET {{baseUrl}}");
		expect(view.state.selection.main.head).toBe(15);
		expect(actions.closeSuggest).toHaveBeenCalledWith(view);
	});

	it("reports a selection for Set as variable and drops it when empty", () => {
		const { view, actions } = editor("token abc123 end");
		view.dispatch({ selection: { anchor: 6, head: 12 } });
		expect(actions.select).toHaveBeenLastCalledWith(
			view,
			"abc123",
			expect.any(Function),
		);
		view.dispatch({ selection: { anchor: 3 } });
		expect(actions.unselect).toHaveBeenLastCalledWith(view);
	});

	it("opens the card when the pointer moves over a reference", () => {
		const { view, actions } = editor("{{nope}} tail");
		const mark = view.contentDOM.querySelector('[data-var="nope"]');
		mark?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
		expect(actions.hover).toHaveBeenCalledWith("nope", expect.anything());
	});

	it("recolours on a new classifier without closing open suggestions", () => {
		const { view, actions, source } = editor("x {{nope}} {{ba");
		view.dispatch({ selection: { anchor: 15 }, userEvent: "input.type" });
		view.dispatch({
			changes: { from: 15, insert: "s" },
			selection: { anchor: 16 },
			userEvent: "input.type",
		});
		actions.closeSuggest.mockClear();
		source.set(() => "resolved");
		expect(classOf(view, "nope")).toContain("cm-var-resolved");
		expect(actions.closeSuggest).not.toHaveBeenCalled();
	});

	it("points the content at the open list and its active option", () => {
		const { view, actions } = editor("GET ");
		view.dispatch({
			changes: { from: 4, insert: "{{" },
			selection: { anchor: 6 },
			userEvent: "input.type",
		});
		const request = actions.suggest.mock.calls.at(-1)?.[0];
		request?.onAria?.({ listId: "list", activeId: "list-option-1" });
		expect(view.contentDOM).toHaveAttribute("aria-controls", "list");
		expect(view.contentDOM).toHaveAttribute(
			"aria-activedescendant",
			"list-option-1",
		);
		request?.onAria?.(null);
		expect(view.contentDOM).not.toHaveAttribute("aria-controls");
	});

	it("opens the card on Shift+F10 inside a reference, Set as variable on a selection", () => {
		const { view, actions } = editor("a {{nope}} b");
		view.dispatch({ selection: { anchor: 5 } });
		expect(contextAction(view, actions)).toBe(true);
		expect(actions.focusCard).toHaveBeenCalledWith(
			"nope",
			expect.anything(),
			view.contentDOM,
		);
		view.dispatch({ selection: { anchor: 0, head: 1 } });
		expect(contextAction(view, actions)).toBe(true);
		expect(actions.setAsVariable).toHaveBeenCalledWith("a");
		view.dispatch({ selection: { anchor: 11 } });
		expect(contextAction(view, actions)).toBe(false);
	});
});
