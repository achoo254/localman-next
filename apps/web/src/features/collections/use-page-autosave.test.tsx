import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePageAutosave } from "./use-page-autosave";

interface Fields {
	name: string;
	description: string;
}

/** A save the test answers by hand, one call at a time. */
function manualSave() {
	const calls: Partial<Fields>[] = [];
	const answers: ((ok: boolean) => void)[] = [];
	const save = (patch: Partial<Fields>) =>
		new Promise<void>((resolve, reject) => {
			calls.push(patch);
			answers.push((ok) => (ok ? resolve() : reject(new Error("down"))));
		});
	const answer = (index: number, ok = true) => answers[index]?.(ok);
	return { save, calls, answer };
}

describe("usePageAutosave", () => {
	it("saves one flush after another, each with what is queued then", async () => {
		const api = manualSave();
		const { result } = renderHook(() =>
			usePageAutosave<Fields>(api.save, 10_000),
		);
		act(() => result.current.edit({ name: "A" }));
		act(() => void result.current.flush());
		await waitFor(() => expect(api.calls).toHaveLength(1));
		act(() => result.current.edit({ name: "B", description: "d" }));
		act(() => void result.current.flush());
		await new Promise((resolve) => setTimeout(resolve, 20));
		// The second save waits for the first answer.
		expect(api.calls).toEqual([{ name: "A" }]);
		await act(async () => api.answer(0));
		await waitFor(() => expect(api.calls).toHaveLength(2));
		expect(api.calls[1]).toEqual({ name: "B", description: "d" });
		await act(async () => api.answer(1));
		await waitFor(() => expect(result.current.status.state).toBe("saved"));
		expect(result.current.pending).toEqual({});
	});

	it("tries a failed save again without undoing newer edits", async () => {
		const api = manualSave();
		const { result } = renderHook(() =>
			usePageAutosave<Fields>(api.save, 10_000),
		);
		act(() => result.current.edit({ name: "A", description: "old" }));
		act(() => void result.current.flush());
		await waitFor(() => expect(api.calls).toHaveLength(1));
		act(() => result.current.edit({ description: "new" }));
		await act(async () => api.answer(0, false));
		await waitFor(() => expect(result.current.status.state).toBe("error"));
		act(() => void result.current.flush());
		await waitFor(() => expect(api.calls).toHaveLength(2));
		expect(api.calls[1]).toEqual({ name: "A", description: "new" });
		expect(result.current.pending).toEqual({ name: "A", description: "new" });
	});

	it("drops unsaved edits on discard and sends nothing later", async () => {
		const api = manualSave();
		const { result } = renderHook(() => usePageAutosave<Fields>(api.save, 20));
		act(() => result.current.edit({ name: "A" }));
		let had = false;
		act(() => {
			had = result.current.discard();
		});
		expect(had).toBe(true);
		expect(result.current.pending).toEqual({});
		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(api.calls).toEqual([]);
		act(() => {
			had = result.current.discard();
		});
		expect(had).toBe(false);
	});
});
