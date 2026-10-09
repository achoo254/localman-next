import {
	type ApiRequestDraft,
	type ClientResponse,
	type PreparedRequest,
	createRequestDraft,
} from "@localman/shared/api-client";
import { type Mock, vi } from "vitest";
import type { ProxyHopOutcome } from "../workbench/proxy-hop";
import type {
	SendOptions,
	SettledResponse,
} from "../workbench/workbench-types";
import type { DirectOutcome } from "./direct-fetch";
import type { RoutingSnapshot, SecretAsk } from "./route-types";
import { createRoutedSender } from "./routed-sender";

export const RESPONSE: ClientResponse = {
	status: 200,
	statusText: "OK",
	headers: [],
	body: "ok",
	bodyEncoding: "utf8",
	size: 2,
	timings: { dns: null, connect: null, tls: null, ttfb: null, total: 5 },
	finalUrl: "https://api.test/",
	truncated: false,
};

export interface Harness {
	/** `routeChosen`: the route was set on the tab (not the default). */
	send: (
		draft: ApiRequestDraft,
		options?: SendOptions,
		routeChosen?: boolean,
	) => Promise<SettledResponse>;
	direct: Mock<(prepared: PreparedRequest) => Promise<DirectOutcome>>;
	proxy: Mock<(prepared: PreparedRequest) => Promise<ProxyHopOutcome>>;
	asks: SecretAsk[];
	cors: Set<string>;
}

/**
 * Router with fake routes: `direct` answers `directOutcome`, the proxy
 * answers 200; `consent` is what the user answers when asked.
 */
export function routerHarness(
	options: {
		directOutcome?: DirectOutcome;
		snapshot?: Partial<RoutingSnapshot>;
		consent?: boolean;
		cors?: string[];
	} = {},
): Harness {
	const cors = new Set(options.cors ?? []);
	const asks: SecretAsk[] = [];
	const direct = vi.fn(
		async (_prepared: PreparedRequest): Promise<DirectOutcome> =>
			options.directOutcome ?? {
				kind: "response",
				response: RESPONSE,
				dropped: [],
			},
	);
	const proxy = vi.fn(
		async (_prepared: PreparedRequest): Promise<ProxyHopOutcome> => ({
			kind: "response",
			response: RESPONSE,
		}),
	);
	const sender = createRoutedSender({
		scripts: {
			run: async () => {
				throw new Error("no script expected");
			},
		},
		snapshot: async () => ({
			pinnedHosts: new Set(),
			secretHosts: new Set(),
			tunnels: new Map(),
			...options.snapshot,
		}),
		corsCache: {
			has: (origin) => cors.has(origin),
			remember: (origin) => {
				cors.add(origin);
			},
		},
		confirmSecrets: async (ask) => {
			asks.push(ask);
			return options.consent ?? false;
		},
		direct,
		proxy,
	});
	return {
		send: (draft, sendOptions, routeChosen = false) =>
			sender({
				draft,
				files: new Map(),
				signal: new AbortController().signal,
				routeChosen,
				...(sendOptions ? { options: sendOptions } : {}),
			}),
		direct,
		proxy,
		asks,
		cors,
	};
}

export function draftFor(
	url: string,
	overrides: Partial<ApiRequestDraft> = {},
): ApiRequestDraft {
	return createRequestDraft({ url, ...overrides });
}
