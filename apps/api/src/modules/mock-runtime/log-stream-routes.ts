import {
	OperationError,
	type OperationRouterOptions,
} from "@localman/operations";
import { type Request, type Response, Router } from "express";
import { messagesFor } from "../../i18n/server-messages.js";
import { TRAFFIC_PATHS } from "../../operations/protocol-routes.js";
import { requireProject } from "../projects/project-service.js";
import { readUserLocale } from "../users/user-locale.js";
import { type LogStreamRegistry, logStreams } from "./log-stream-registry.js";
import {
	type LogFilter,
	matchesLogFilter,
	parseLogFilter,
} from "./request-log-filter.js";
import type { StoredRequestLog } from "./request-log-model.js";
import { type RequestLogService, requestLog } from "./request-log-service.js";
import { toLogSummary } from "./request-log-view.js";

/** Live logs one account may keep open (tabs, devices). */
export const MAX_STREAMS_PER_USER = 5;
/** Comment line every 25 s: keeps proxies from closing an idle stream. */
export const HEARTBEAT_MS = 25_000;
/**
 * A stream whose client stopped reading (socket buffer full) at this many
 * heartbeats in a row is closed; until then lines for it are dropped.
 */
const STALLED_BEATS = 2;

export interface LogStreamOptions {
	readonly resolveAuth: OperationRouterOptions["resolveAuth"];
	readonly service?: RequestLogService;
	readonly maxPerUser?: number;
	readonly heartbeatMs?: number;
	/** Open streams; the process's `logStreams` by default. */
	readonly streams?: LogStreamRegistry;
}

/** Ends every live log and refuses new ones (shutdown). */
export function closeLogStreams(): void {
	logStreams.close();
}

function queryString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function sendError(res: Response, error: OperationError): void {
	res.status(error.status).json(error.toBody());
}

async function open(
	req: Request,
	res: Response,
	options: Required<LogStreamOptions>,
): Promise<void> {
	// Set before any await: a client gone while authenticating gets no slot.
	let gone = false;
	res.once("close", () => {
		gone = true;
	});
	const { streams } = options;
	streams.assertOpen();
	const auth = await options.resolveAuth(req);
	if (!auth) {
		throw new OperationError(401, "UNAUTHENTICATED", "Authentication required");
	}
	const sub = auth.subjectId;
	const projectId = String(req.params.projectId ?? "");
	const filter: LogFilter = parseLogFilter({
		method: queryString(req.query.method),
		status: queryString(req.query.status),
		source: queryString(req.query.source),
		path: queryString(req.query.path),
	});
	const project = await requireProject(sub, "read", projectId);
	if (gone || req.socket.destroyed) return;
	// Shutdown may have started while this stream authenticated.
	streams.assertOpen();
	const max = options.maxPerUser;
	if (streams.countOf(sub) >= max) {
		const texts = messagesFor(await readUserLocale(sub)).traffic;
		throw new OperationError(
			429,
			"TOO_MANY_STREAMS",
			texts.streamLimit({ max }),
			{ max },
		);
	}
	// Remembered so that ending the session (sign-out) ends the stream.
	const sessionId =
		"sessionId" in auth && typeof auth.sessionId === "string"
			? auth.sessionId
			: undefined;
	const release = streams.add(sub, res, sessionId);
	res.status(200);
	res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
	res.setHeader("Cache-Control", "no-store");
	// nginx would otherwise buffer the stream.
	res.setHeader("X-Accel-Buffering", "no");
	res.flushHeaders();
	res.write("retry: 5000\n\n");

	// Backpressure: while the socket buffer is full, lines are dropped.
	const send = (line: StoredRequestLog): void => {
		if (res.writableNeedDrain || !matchesLogFilter(line, filter)) return;
		const data = JSON.stringify(toLogSummary(line));
		res.write(`id: ${line._id.toHexString()}\nevent: log\ndata: ${data}\n\n`);
	};
	const unsubscribe = options.service.subscribe(
		project._id.toHexString(),
		send,
	);
	// Each heartbeat checks access again: a removed member or a deleted
	// project loses the stream within one beat; so does a stalled client.
	let stalled = 0;
	const heartbeat = setInterval(() => {
		stalled = res.writableNeedDrain ? stalled + 1 : 0;
		if (stalled >= STALLED_BEATS) {
			res.destroy();
			return;
		}
		requireProject(sub, "read", projectId).then(
			() => res.write(": ping\n\n"),
			() => res.end(),
		);
	}, options.heartbeatMs);
	heartbeat.unref();
	res.once("close", () => {
		clearInterval(heartbeat);
		unsubscribe();
		release();
	});
}

/**
 * Live request log of a project over Server-Sent Events (`event: log`,
 * `data`: the row of `traffic.listRequestLogs`, `id`: the line id), with
 * the list's method, status, source and path filters. Members only (401,
 * 404, 403 as the operations); at most `MAX_STREAMS_PER_USER` open per
 * account (429 `TOO_MANY_STREAMS`); 503 `SHUTTING_DOWN` once shutdown
 * began. A client that stops reading loses lines, then the stream. A
 * protocol route, not an operation: an SSE stream has no single JSON
 * answer for REST or an MCP tool.
 */
export function createLogStreamRouter(options: LogStreamOptions): Router {
	const settings: Required<LogStreamOptions> = {
		resolveAuth: options.resolveAuth,
		service: options.service ?? requestLog,
		maxPerUser: options.maxPerUser ?? MAX_STREAMS_PER_USER,
		heartbeatMs: options.heartbeatMs ?? HEARTBEAT_MS,
		streams: options.streams ?? logStreams,
	};
	const router = Router();
	router.get(TRAFFIC_PATHS.logStream, (req, res, next) => {
		open(req, res, settings).catch((error: unknown) => {
			if (res.headersSent) return;
			if (error instanceof OperationError) return sendError(res, error);
			next(error);
		});
	});
	return router;
}
