import type { LocalValue, VariableView } from "@localman/shared/api-client";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VariableWrite } from "./environments-api";
import type { LocalValueWrite } from "./local-values-api";
import {
	type VariableEditorOptions,
	useVariableEditor,
} from "./use-variable-editor";

const variable = (key: string, sharedValue: string | null): VariableView => ({
	id: `id-${key}`,
	key,
	type: "default",
	enabled: true,
	description: "",
	sharedValue,
	sharedHidden: false,
});

/** A server: saves get ids by name; the hook reads what it answers. */
function setup(initial: VariableView[], localValues: LocalValue[] = []) {
	const puts: VariableWrite[][] = [];
	const patches: LocalValueWrite[][] = [];
	let server = initial;
	let local = localValues;
	const control = { failShared: false };
	const view = renderHook<
		ReturnType<typeof useVariableEditor>,
		VariableEditorOptions
	>((props) => useVariableEditor(props), {
		initialProps: {
			variables: server,
			localValues: local,
			canEdit: true,
			saveShared: async () => {},
			saveLocal: async () => {},
		},
	});
	const props = (): VariableEditorOptions => ({
		variables: server,
		localValues: local,
		canEdit: true,
		saveShared: async (writes) => {
			puts.push(writes);
			if (control.failShared) throw new Error("shared save failed");
			server = writes.map((w) => ({
				...variable(w.key, w.sharedValue),
				id: w.id ?? `srv-${w.key}`,
			}));
			view.rerender(props());
		},
		saveLocal: async (values) => {
			patches.push(values);
			const map = new Map(local.map((l) => [l.key, l.value]));
			for (const { key, value } of values) {
				if (value === null) map.delete(key);
				else map.set(key, value);
			}
			local = [...map].map(([key, value]) => ({ key, value }));
			view.rerender(props());
		},
	});
	view.rerender(props());
	const refetch = () => view.rerender({ ...props(), variables: [...server] });
	return { view, puts, patches, refetch, control };
}

/** Past the autosave pause, then the save's promises. */
async function pause() {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(900);
	});
}

const keys = (hook: ReturnType<typeof setup>["view"]) =>
	hook.result.current.rows.map((row) => row.variable.key);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useVariableEditor", () => {
	it("keeps a blank row past the pause and saves nothing for it", async () => {
		const { view, puts } = setup([variable("a", "1")]);
		act(() => {
			view.result.current.addVariable();
		});
		await pause();
		expect(keys(view)).toEqual(["a", ""]);
		expect(puts).toHaveLength(0);
	});

	it("keeps the row id of a new row once the server names it", async () => {
		const { view } = setup([variable("a", "1")]);
		let rowId = "";
		act(() => {
			rowId = view.result.current.addVariable();
		});
		act(() => view.result.current.editVariable(rowId, { key: "b" }));
		await pause();
		const row = view.result.current.rows[1];
		expect(row?.variable.rowId).toBe(rowId);
		expect(row?.variable.id).toBe("srv-b");
		expect(row?.variable.isNew).toBe(false);
	});

	it("keeps a row with a duplicate name through a refetch", async () => {
		const { view, refetch, puts } = setup([variable("a", "1")]);
		let rowId = "";
		act(() => {
			rowId = view.result.current.addVariable();
		});
		act(() => view.result.current.editVariable(rowId, { key: "a" }));
		refetch();
		await pause();
		expect(keys(view)).toEqual(["a", "a"]);
		expect(view.result.current.duplicates.has("a")).toBe(true);
		expect(puts).toHaveLength(0);
	});

	it("moves a local value to the new name only after the rename is saved", async () => {
		const { view, patches } = setup(
			[variable("a", "x"), variable("ab", "y")],
			[
				{ key: "a", value: "1" },
				{ key: "ab", value: "2" },
			],
		);
		const rowId = view.result.current.rows[1]?.variable.rowId ?? "";
		act(() => view.result.current.editVariable(rowId, { key: "a" }));
		act(() => view.result.current.editVariable(rowId, { key: "ac" }));
		await pause();
		expect(patches).toEqual([
			[
				{ key: "ab", value: null },
				{ key: "ac", value: "2" },
			],
		]);
		const rows = view.result.current.rows;
		expect(rows.map((row) => [row.variable.key, row.local])).toEqual([
			["a", "1"],
			["ac", "2"],
		]);
	});

	it("resets shared local values only once the shared save succeeds", async () => {
		const { view, puts, patches, control } = setup(
			[variable("a", "1"), variable("b", null)],
			[
				{ key: "a", value: "2" },
				{ key: "b", value: "3" },
			],
		);
		control.failShared = true;
		act(() => view.result.current.shareRows(view.result.current.rows));
		await pause();
		expect(puts).toHaveLength(1);
		expect(patches).toEqual([]);
		expect(view.result.current.status.state).toBe("error");
		expect(view.result.current.rows.map((row) => row.local)).toEqual([
			"2",
			"3",
		]);
		control.failShared = false;
		await act(() => view.result.current.flush());
		expect(puts.at(-1)?.map((w) => [w.key, w.sharedValue])).toEqual([
			["a", "2"],
			["b", "3"],
		]);
		expect(patches).toEqual([
			[
				{ key: "a", value: null },
				{ key: "b", value: null },
			],
		]);
	});

	it("keeps a local value typed after Share instead of resetting it", async () => {
		const { view, patches } = setup(
			[variable("a", "1")],
			[{ key: "a", value: "2" }],
		);
		act(() => view.result.current.shareRows(view.result.current.rows));
		act(() => view.result.current.editLocal("a", "9"));
		await pause();
		expect(patches).toEqual([[{ key: "a", value: "9" }]]);
	});
});
