import type { ApiRequestDraft } from "@localman/shared/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { ToastProvider } from "../../../components/ui/toast";
import { TooltipProvider } from "../../../components/ui/tooltip";
import { ApiClientScreen } from "../../../pages/api-client/api-client-screen";
import { createTestQueryClient } from "../../../test/render-app";
import { DEFAULT_CLIENT_SETTINGS } from "../routing/client-settings-api";
import type { RequestSender } from "./send-types";
import { WorkbenchProvider } from "./workbench-context";
import type { SettledResponse } from "./workbench-types";

export interface ApiCall {
	method: string;
	path: string;
	body: unknown;
}

const USAGE = {
	plan: "free",
	planExpiresAt: null,
	period: "2026-10",
	projects: { used: 1, max: 3 },
	mockRequests: { used: 0, max: 10_000 },
	proxyRequests: { used: 12, max: 5_000 },
};

/** What the history API answers to a recorded send. */
function historyEntry(body: unknown) {
	const record = typeof body === "object" && body !== null ? body : {};
	const draft = "draft" in record ? record.draft : {};
	const response = "response" in record ? record.response : {};
	return {
		id: "h1",
		name: "",
		...(typeof draft === "object" && draft !== null ? draft : {}),
		response: {
			finalUrl: null,
			...(typeof response === "object" ? response : {}),
		},
		bodyOmitted: false,
		createdAt: "2026-10-10T00:00:00Z",
	};
}

/**
 * Stubs the client endpoints the workbench calls: draft list (given
 * drafts), draft saves and deletes by any tab id, history, account usage,
 * routing settings (defaults). Every call is recorded in order.
 */
export function stubClientApi(
	drafts: { tabId: string; draft: ApiRequestDraft }[] = [],
) {
	const calls: ApiCall[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const path = new URL(String(input), window.location.origin).pathname;
			const method = init?.method ?? "GET";
			const body =
				typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
			calls.push({ method, path, body });
			let reply: unknown = { error: { code: "NOT_FOUND", message: "no stub" } };
			let status = 404;
			if (method === "GET" && path === "/api/v1/client/drafts") {
				reply = {
					items: drafts.map((item, order) => ({
						...item,
						order,
						updatedAt: "2026-10-10T00:00:00Z",
					})),
				};
				status = 200;
			} else if (path.startsWith("/api/v1/client/drafts/")) {
				reply = method === "DELETE" ? { tabId: "x", deleted: true } : {};
				status = 200;
			} else if (path === "/api/v1/client/history") {
				reply =
					method === "GET"
						? { items: [], nextCursor: null }
						: historyEntry(body);
				status = 200;
			} else if (path === "/api/v1/account/usage") {
				reply = USAGE;
				status = 200;
			} else if (method === "GET" && path === "/api/v1/client/settings") {
				reply = DEFAULT_CLIENT_SETTINGS;
				status = 200;
			}
			return new Response(JSON.stringify(reply), {
				status,
				headers: { "Content-Type": "application/json" },
			});
		}),
	);
	return calls;
}

/** Sender that answers 200 with the request URL as body. */
export function echoSender(): RequestSender & { drafts: ApiRequestDraft[] } {
	const drafts: ApiRequestDraft[] = [];
	const send = async ({
		draft,
	}: { draft: ApiRequestDraft }): Promise<SettledResponse> => {
		drafts.push(draft);
		return {
			kind: "done",
			result: {
				response: {
					status: 200,
					statusText: "OK",
					headers: [],
					body: `echo ${draft.method} ${draft.url}`,
					bodyEncoding: "utf8",
					size: 4,
					timings: {
						dns: null,
						connect: null,
						tls: null,
						ttfb: null,
						total: 9,
					},
					finalUrl: draft.url,
					truncated: false,
				},
				route: "proxy",
				request: { method: draft.method, url: draft.url },
				preScript: null,
				postScript: null,
				finishedAt: "2026-10-10T00:00:00Z",
			},
		};
	};
	return Object.assign(send, { drafts });
}

/** Short waits between tries of a failed draft write. */
const TEST_RETRY_DELAYS_MS: readonly number[] = [5, 5];

export function renderWorkbench(
	options: {
		sender?: RequestSender;
		saveDelayMs?: number;
		retryDelaysMs?: readonly number[];
	} = {},
) {
	return render(
		<QueryClientProvider client={createTestQueryClient()}>
			<TooltipProvider>
				<ToastProvider>
					<WorkbenchProvider
						sender={options.sender ?? echoSender()}
						saveDelayMs={options.saveDelayMs ?? 10}
						retryDelaysMs={options.retryDelaysMs ?? TEST_RETRY_DELAYS_MS}
					>
						<ApiClientScreen />
					</WorkbenchProvider>
				</ToastProvider>
			</TooltipProvider>
		</QueryClientProvider>,
	);
}

/** `data-id` lookup inside the document; throws when missing. */
export function byDataId(id: string): HTMLElement {
	const element = document.querySelector(`[data-id="${id}"]`);
	if (!(element instanceof HTMLElement)) {
		throw new Error(`No element with data-id="${id}"`);
	}
	return element;
}
