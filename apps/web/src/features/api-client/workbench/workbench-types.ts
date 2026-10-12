/**
 * Shared contract of the API client workbench: tabs, per-tab response and
 * the request sender. Editor, response viewer, history, import/export and
 * router share state only through these shapes and `workbench-context.tsx`.
 */
import type {
	ApiRequestDraft,
	ClientResponse,
	HttpMethod,
	ResolverLayer,
	RouteMode,
	TabSource,
} from "@localman/shared/api-client";
import type {
	ScriptError,
	ScriptLogEntry,
	ScriptTestResult,
} from "@localman/shared/api-client/script-sandbox";
import type { SendContext } from "./workbench-tab-types";

/**
 * Where a request went. The proxy-only sender always uses the proxy; the
 * router adds `direct` and `tunelo`.
 */
export const SEND_ROUTES = ["direct", "proxy", "tunelo"] as const;
export type SendRoute = (typeof SEND_ROUTES)[number];

/**
 * Why the router picked the route of a send:
 * - `manual`: the tab's route (Proxy or Direct), or a retry button;
 * - `pinned`: the host is in "always through the proxy";
 * - `forbidden`: a header `fetch` cannot set (`forbidden` names it);
 * - `redirects`: "Follow redirects" is off, which `fetch` cannot show;
 * - `remembered`: the origin recently failed a direct send (CORS cache);
 * - `cors`: the direct send failed (`TypeError`), then resent;
 * - `direct`: sent from the browser, the target allows CORS.
 * A Tunelo send (route `tunelo`) gives the same reasons for the tunnel.
 */
export type RouteWhy =
	| "manual"
	| "pinned"
	| "forbidden"
	| "redirects"
	| "remembered"
	| "cors"
	| "direct";

/** How the router got the response (badge tooltip and note). */
export interface RouteInfo {
	why: RouteWhy;
	/** `host[:port]` of the target, or the local key (`localhost:3000`). */
	host: string;
	/** The target is on the user's machine or network. */
	local: boolean;
	/** Headers `fetch` cannot set: why it went through the proxy, or dropped. */
	forbidden: string[];
	/** Direct sends only: headers the browser left out. */
	dropped: string[];
	/** Tunelo sends only: origin of the tunnel used. */
	tunnelUrl?: string;
}

/** Why a direct send got nothing (`fetch` tells no more). */
export type DirectFailReason =
	/** `TypeError`: CORS, mixed content, Local Network Access or network. */
	| "blocked"
	| "timeout"
	/** "Follow redirects" off: the browser hides the redirect response. */
	| "redirect"
	/** The target answered, then the connection broke: not sent again. */
	| "interrupted"
	/** A POST or PATCH may have reached the target: not sent again on its own. */
	| "notRetried";

/** A send the router stopped, with what the response area offers next. */
export type RouteFailure =
	| { kind: "direct"; reason: DirectFailReason; host: string; local: boolean }
	/** A local target the browser could not reach and no tunnel is set. */
	| { kind: "tunnel"; key: string; port: number; directFailed: boolean }
	/** Credentials would have gone through the proxy; the user said no. */
	| { kind: "consent"; host: string; parts: string[] };

/** What one pre-request or post-response script left to show. */
export interface ScriptOutcome {
	tests: ScriptTestResult[];
	logs: ScriptLogEntry[];
	/** Some console output was dropped or cut by the sandbox caps. */
	logsTruncated: boolean;
	error: ScriptError | null;
}

/** A send that got a response (any HTTP status). */
export interface SendResult {
	response: ClientResponse;
	route: SendRoute;
	/** Method and URL actually sent: after the pre-request script and `{{var}}`. */
	request: { method: HttpMethod; url: string };
	/** `null` when the tab has no script of that kind. */
	preScript: ScriptOutcome | null;
	postScript: ScriptOutcome | null;
	/** ISO time the response (and post-response script) finished. */
	finishedAt: string;
	/** Set by the router; the proxy-only sender leaves it out. */
	routing?: RouteInfo;
}

/** A send that produced no response. */
export interface SendFailure {
	/**
	 * `RequestPrepareError` codes (`INVALID_URL`, `FILE_MISSING`…), script
	 * codes (`SCRIPT_ERROR`, `SCRIPT_TIMEOUT`…) or API error codes of the
	 * proxy (`MONTHLY_QUOTA_EXCEEDED`, `PROXY_TARGET_BLOCKED`,
	 * `NETWORK_ERROR`…).
	 */
	code: string;
	/** Text safe to show, in the language on screen when the send failed. */
	message: string;
	/** HTTP status of the Localman API answer; `null` when none. */
	status: number | null;
	/** `error.details` of an API error, unvalidated. */
	details?: unknown;
	/** Output of the pre-request script when it ran (it may be the cause). */
	preScript: ScriptOutcome | null;
	/** Set when the router, not the network, stopped the send. */
	routing?: RouteFailure;
}

/** Response area of one tab. */
export type TabResponse =
	| { kind: "idle" }
	| { kind: "sending" }
	| {
			kind: "done";
			result: SendResult;
			/** The draft as sent, kept with its response (an example saves both). */
			draft?: ApiRequestDraft;
	  }
	| { kind: "failed"; failure: SendFailure }
	| { kind: "cancelled" };

/** How a send ended; what a `RequestSender` resolves to. */
export type SettledResponse = Exclude<
	TabResponse,
	{ kind: "idle" | "sending" }
>;

export interface WorkbenchTab {
	/** Also the server key of the tab's draft: `[A-Za-z0-9_-]{1,64}`. */
	id: string;
	draft: ApiRequestDraft;
	/**
	 * The tab holds edits that are not saved anywhere but its draft:
	 * shown as a dot, and closing asks first. Set by any edit; a tab
	 * restored after a reload is dirty when it is not a blank request.
	 */
	dirty: boolean;
	/** Picked files by `FileRef.fileId`; they never reach the draft API. */
	files: ReadonlyMap<string, File>;
	response: TabResponse;
	/**
	 * The user set the route on this tab. A route that came with the draft
	 * (account default, restore) is no choice: credentials still need an OK.
	 */
	routeChosen: boolean;
	/** Opened from a history entry whose credentials were hidden. */
	redacted: boolean;
	/** The collection request this tab edits; `null` for a loose request. */
	source: TabSource | null;
	/** That request's draft as last saved or loaded; `dirty` compares to it. */
	saved: ApiRequestDraft | null;
}

/** One-off choices for a single send (retry buttons of the response). */
export interface SendOptions {
	route?: RouteMode; // for this send only; the tab keeps its own
	/** After a browser `TypeError`: a proxy success remembers the origin. */
	afterDirectBlocked?: boolean;
}

export interface SendInput {
	draft: ApiRequestDraft;
	files: ReadonlyMap<string, File>;
	/** Aborted by "Cancel" or when the tab closes. */
	signal: AbortSignal;
	options?: SendOptions;
	/** `WorkbenchTab.routeChosen`; `options.route` counts as chosen too. */
	routeChosen?: boolean;
	/** Auth, scripts and variables from the collection of a bound tab. */
	context?: SendContext;
	/** Globals, collection and environment with local values (flag on). */
	variables?: readonly ResolverLayer[];
}

/**
 * Sends one request, scripts included. Never rejects: every failure comes
 * back as `{ kind: "failed" }`, an abort as `{ kind: "cancelled" }`.
 */
export type RequestSender = (input: SendInput) => Promise<SettledResponse>;
