import type { ClientResponse } from "@localman/shared/api-client";
import { render } from "@testing-library/react";
import { ToastProvider } from "../../../components/ui/toast";
import type {
	ScriptOutcome,
	SendRoute,
	TabResponse,
} from "../workbench/workbench-types";
import { ResponsePanel } from "./response-panel";

/** Fixtures of the response viewer tests. */
export const JSON_BODY = '{"id":1,"name":"Ada","tags":["a","b"]}';

export function clientResponse(
	overrides: Partial<ClientResponse> = {},
): ClientResponse {
	return {
		status: 200,
		statusText: "OK",
		headers: [{ name: "Content-Type", value: "application/json" }],
		body: JSON_BODY,
		bodyEncoding: "utf8",
		size: JSON_BODY.length,
		timings: { dns: 4, connect: 10, tls: 20, ttfb: 80, total: 95 },
		finalUrl: "https://api.example.com/users/1",
		truncated: false,
		...overrides,
	};
}

export function done(
	overrides: Partial<ClientResponse> = {},
	route: SendRoute = "proxy",
	postScript: ScriptOutcome | null = null,
): TabResponse {
	return {
		kind: "done",
		result: {
			response: clientResponse(overrides),
			route,
			request: { method: "GET", url: "https://api.example.com/users/1" },
			preScript: null,
			postScript,
			finishedAt: "2026-10-10T01:00:00.000Z",
		},
	};
}

export function renderPanel(response: TabResponse, onCancel?: () => void) {
	return render(
		<ToastProvider>
			<ResponsePanel response={response} onCancel={onCancel} />
		</ToastProvider>,
	);
}

export const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);
