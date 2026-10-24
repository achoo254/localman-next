/**
 * Where the data of the API client lives, what the proxy logs and what
 * Localman measures: the one source of the public page "Where your data
 * lives" (`/your-data`). Numbers come from the constants the code runs
 * on, and the API's tests check the rest against the code (proxy log
 * fields, server request log fields, nightly backups kept), so the page
 * cannot drift from what the server does.
 */
import { HISTORY_MAX_ENTRIES, HISTORY_TTL_DAYS } from "./api-client/limits.js";
import { FREE_LIMITS, PRO_LIMITS } from "./plan-limits.js";

/**
 * - `device`: never leaves the browser.
 * - `serverSealed`: on the server as ciphertext only the browser opens.
 * - `serverEncrypted`: on the server, encrypted with the server's key so
 *   that the server can use it (sharing, agents).
 * - `server`: on the server as is.
 * - `passing`: goes through the server on its way, not stored.
 */
export type DataPlace =
	| "device"
	| "serverSealed"
	| "serverEncrypted"
	| "server"
	| "passing";

export type DataItemId =
	| "vaultPassphrase"
	| "vaultValues"
	| "directSends"
	| "proxySends"
	| "agentCopies"
	| "sharedSecrets"
	| "collectionSecrets"
	| "variables"
	| "collections"
	| "requestTabs"
	| "history"
	| "mockLogs"
	| "backups";

export interface DataItem {
	readonly id: DataItemId;
	readonly place: DataPlace;
	/**
	 * How long the server keeps it, in days; `null` while you keep it (until
	 * you delete it or your account). Two values: standard and extended limits.
	 */
	readonly keptDays: number | readonly [number, number] | null;
	/** Newest entries kept per account, when capped. */
	readonly maxEntries: number | null;
}

/** Nightly database backups kept on the server (`backup-localman-db.sh`). */
export const NIGHTLY_BACKUPS_KEPT = 14;

export const DATA_ITEMS: readonly DataItem[] = [
	{ id: "vaultPassphrase", place: "device", keptDays: null, maxEntries: null },
	{
		id: "vaultValues",
		place: "serverSealed",
		keptDays: null,
		maxEntries: null,
	},
	{ id: "directSends", place: "device", keptDays: null, maxEntries: null },
	{ id: "proxySends", place: "passing", keptDays: null, maxEntries: null },
	{
		id: "agentCopies",
		place: "serverEncrypted",
		keptDays: null,
		maxEntries: null,
	},
	{
		id: "sharedSecrets",
		place: "serverEncrypted",
		keptDays: null,
		maxEntries: null,
	},
	{
		id: "collectionSecrets",
		place: "server",
		keptDays: null,
		maxEntries: null,
	},
	{ id: "variables", place: "server", keptDays: null, maxEntries: null },
	{ id: "collections", place: "server", keptDays: null, maxEntries: null },
	{ id: "requestTabs", place: "server", keptDays: null, maxEntries: null },
	{
		id: "history",
		place: "server",
		keptDays: HISTORY_TTL_DAYS,
		maxEntries: HISTORY_MAX_ENTRIES,
	},
	{
		id: "mockLogs",
		place: "server",
		keptDays: [FREE_LIMITS.requestLogDays, PRO_LIMITS.requestLogDays],
		maxEntries: null,
	},
	{
		id: "backups",
		place: "server",
		keptDays: NIGHTLY_BACKUPS_KEPT,
		maxEntries: null,
	},
];

/**
 * Everything one line of the proxy log may hold: the account, the
 * destination host (secrets in it masked), the method, the status or the
 * error code, the time taken and the tunnel a local target went through.
 * Never the path, query, headers or bodies.
 */
export const PROXY_LOG_FIELDS = [
	"sub",
	"host",
	"method",
	"status",
	"error",
	"ms",
	"via",
] as const;

/**
 * One line per request to the server: the route as its template
 * (`/api/v1/projects/:projectId`), for a mock API its path with the
 * project's secret masked; never a query, header, cookie or body; the
 * project's id when the request is about one; `aborted` when the client
 * hung up. A failure adds a line with the error.
 */
export const REQUEST_LOG_FIELDS = [
	"requestId",
	"method",
	"route",
	"status",
	"ms",
	"projectId",
	"aborted",
] as const;

/**
 * One line per request in the access log of the web server in front
 * (nginx, `log_format localman`): never the host, the query (hidden),
 * cookies or the Referer.
 */
export const WEB_SERVER_LOG_FIELDS = [
	"ip",
	"time",
	"method",
	"path",
	"status",
	"bytes",
	"userAgent",
	"duration",
] as const;

/** Keys pino adds to every line (`base`, level, time, message). */
export const LOG_ENVELOPE_FIELDS = [
	"level",
	"time",
	"msg",
	"pid",
	"hostname",
	"service",
] as const;

/** No analytics, tracking or error reporting service in the web app or the API. */
export const TELEMETRY_SERVICES: readonly string[] = [];
