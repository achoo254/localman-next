import {
	type ScriptScopeChanges,
	createRequestDraft,
} from "@localman/shared/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/ui/toast";
import { createTestQueryClient } from "../../../test/render-app";
import type { SaveScopes, ScopeSaveResult } from "./send-hooks";
import type { RequestSender } from "./send-types";
import { useSendTab } from "./use-send-tab";
import { INITIAL_WORKBENCH, workbenchReducer } from "./workbench-reducer";
import { echoSender } from "./workbench-test-utils";

const CHANGES: ScriptScopeChanges = {
	globals: [],
	collectionVariables: [{ key: "page", value: "2" }],
	environment: [{ key: "token", value: "abc" }],
};

/** The echo sender, its scripts having changed `CHANGES`. */
function changingSender(): RequestSender {
	const echo = echoSender();
	return async (input) => {
		input.onScopeChanges?.(CHANGES);
		return echo(input);
	};
}

/** Scripts changed `CHANGES`, then the network failed. */
const failingSender: RequestSender = async (input) => {
	input.onScopeChanges?.(CHANGES);
	return {
		kind: "failed",
		failure: {
			code: "NETWORK_ERROR",
			message: "offline",
			status: null,
			preScript: null,
		},
	};
};

/** Scripts changed `CHANGES`, then the request waits until cancelled. */
const hangingSender: RequestSender = (input) =>
	new Promise((resolve) => {
		input.onScopeChanges?.(CHANGES);
		input.signal.addEventListener("abort", () =>
			resolve({ kind: "cancelled" }),
		);
	});

/** A `SaveScopes` whose commit answers `saved`; both are spies. */
function saver(saved: boolean, dropped: ScopeSaveResult["dropped"] = []) {
	const commit = vi.fn(
		async (_changes: ScriptScopeChanges): Promise<ScopeSaveResult> => ({
			saved,
			dropped,
		}),
	);
	const start = vi.fn<SaveScopes>(() => commit);
	return { start, commit };
}

function wrapper({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={createTestQueryClient()}>
			<ToastProvider>{children}</ToastProvider>
		</QueryClientProvider>
	);
}

function renderSend(sender: RequestSender, saveScopes: SaveScopes) {
	const state = workbenchReducer(INITIAL_WORKBENCH, {
		type: "open",
		id: "tab-1",
		draft: createRequestDraft({ url: "https://api.test/users" }),
		files: new Map(),
		activate: true,
		redacted: false,
		source: { collectionId: "col-1", nodeId: "node-1" },
	});
	const latest = { current: state };
	const dispatch = vi.fn((action) => {
		latest.current = workbenchReducer(latest.current, action);
	});
	return renderHook(
		() => useSendTab(latest, dispatch, sender, { saveScopes }),
		{ wrapper },
	);
}

describe("useSendTab saving what scripts set in the scopes", () => {
	it("fixes the targets when the send starts, then saves the changes", async () => {
		const { start, commit } = saver(true);
		const { result } = renderSend(changingSender(), start);
		await act(() => result.current.send("tab-1"));
		expect(start).toHaveBeenCalledWith("col-1");
		expect(commit).toHaveBeenCalledWith(CHANGES);
		expect(start.mock.invocationCallOrder[0]).toBeLessThan(
			commit.mock.invocationCallOrder[0] ?? 0,
		);
	});

	it("keeps what the scripts set when the request fails", async () => {
		const { start, commit } = saver(true);
		const { result } = renderSend(failingSender, start);
		await act(() => result.current.send("tab-1"));
		expect(commit).toHaveBeenCalledWith(CHANGES);
	});

	it("keeps what the pre-request scripts set when the send is cancelled", async () => {
		const { start, commit } = saver(true);
		const { result } = renderSend(hangingSender, start);
		let sending: Promise<void> = Promise.resolve();
		act(() => {
			sending = result.current.send("tab-1");
		});
		await waitFor(() => expect(start).toHaveBeenCalledWith("col-1"));
		act(() => result.current.cancel("tab-1"));
		await act(() => sending);
		expect(commit).toHaveBeenCalledWith(CHANGES);
	});

	it("says so when the changes could not be saved", async () => {
		const { start } = saver(false);
		const { result } = renderSend(changingSender(), start);
		await act(() => result.current.send("tab-1"));
		expect(
			await screen.findByText(/variables your scripts set could not be saved/),
		).toBeVisible();
	});

	it("says when the scripts wrote a scope with nowhere to keep it", async () => {
		const { start } = saver(true, ["environment"]);
		const { result } = renderSend(changingSender(), start);
		await act(() => result.current.send("tab-1"));
		expect(await screen.findByText(/nowhere to keep them/)).toBeVisible();
	});

	it("saves nothing when the scripts changed nothing", async () => {
		const { start, commit } = saver(true);
		const { result } = renderSend(echoSender(), start);
		await act(() => result.current.send("tab-1"));
		expect(commit).not.toHaveBeenCalled();
	});
});
