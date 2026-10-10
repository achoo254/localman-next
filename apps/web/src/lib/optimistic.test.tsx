import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "../components/ui/toast";
import { createTestQueryClient } from "../test/render-app";
import { findToast } from "../test/toast";
import { ApiError } from "./api-client";
import { useOptimisticMutation } from "./optimistic";

interface Item {
	id: string;
	name: string;
}

const KEY = ["items"] as const;

function setup(mutationFn: (vars: Item) => Promise<Item>) {
	const client = createTestQueryClient();
	client.setQueryData<Item[]>(KEY, [{ id: "a", name: "Old" }]);
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>
			<ToastProvider>{children}</ToastProvider>
		</QueryClientProvider>
	);
	const hook = renderHook(
		() =>
			useOptimisticMutation({
				queryKey: KEY,
				mutationFn,
				apply: (list: Item[], next: Item) =>
					list.map((item) => (item.id === next.id ? next : item)),
			}),
		{ wrapper },
	);
	return { client, hook };
}

describe("useOptimisticMutation", () => {
	it("updates the cache before the server answers, then refetches", async () => {
		let answer: (item: Item) => void = () => undefined;
		const { client, hook } = setup(
			(vars) =>
				new Promise<Item>((resolve) => {
					answer = () => resolve(vars);
				}),
		);
		act(() => hook.result.current.mutate({ id: "a", name: "New" }));
		await waitFor(() =>
			expect(client.getQueryData(KEY)).toEqual([{ id: "a", name: "New" }]),
		);
		expect(client.getQueryState(KEY)?.isInvalidated).toBe(false);
		await act(async () => answer({ id: "a", name: "New" }));
		await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
		// Invalidation marks the entry stale; a later observer refetches it.
		expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
	});

	it("rolls back and toasts the error when the server refuses", async () => {
		const { client, hook } = setup(() =>
			Promise.reject(new ApiError(409, "CONFLICT", "Name already taken.")),
		);
		act(() => hook.result.current.mutate({ id: "a", name: "New" }));
		await waitFor(() => expect(hook.result.current.isError).toBe(true));
		expect(client.getQueryData(KEY)).toEqual([{ id: "a", name: "Old" }]);
		expect(await findToast("Name already taken.")).toHaveAttribute(
			"data-tone",
			"error",
		);
	});

	it("leaves an empty cache alone", async () => {
		const { client, hook } = setup((vars) => Promise.resolve(vars));
		client.removeQueries({ queryKey: KEY });
		act(() => hook.result.current.mutate({ id: "a", name: "New" }));
		await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
		expect(client.getQueryData(KEY)).toBeUndefined();
	});

	it("refetches only after the last of overlapping writes settles", async () => {
		const answers: Array<() => void> = [];
		const { client, hook } = setup(
			(vars) =>
				new Promise<Item>((resolve) => {
					answers.push(() => resolve(vars));
				}),
		);
		act(() => hook.result.current.mutate({ id: "a", name: "First" }));
		act(() => hook.result.current.mutate({ id: "a", name: "Second" }));
		await waitFor(() => expect(answers).toHaveLength(2));
		await act(async () => answers[0]?.());
		expect(client.getQueryState(KEY)?.isInvalidated).toBe(false);
		expect(client.getQueryData(KEY)).toEqual([{ id: "a", name: "Second" }]);
		await act(async () => answers[1]?.());
		await waitFor(() =>
			expect(client.getQueryState(KEY)?.isInvalidated).toBe(true),
		);
	});
});
