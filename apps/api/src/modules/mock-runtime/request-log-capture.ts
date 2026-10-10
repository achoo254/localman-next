import type { IncomingMessage } from "node:http";
import type { HeaderEntry } from "@localman/shared/api-client";
import type { Request, Response } from "express";
import { fromRawHeaders } from "../api-client/proxy-headers.js";
import { LOG_BODY_LIMIT, type RequestLogInput } from "./request-log-entry.js";
import type { RequestLogSource } from "./request-log-model.js";
import type { RequestLogService } from "./request-log-service.js";
import type { MockAddress, MockProject } from "./resolve-project.js";
import { isInfrastructureHeader } from "./upstream-headers.js";

/**
 * Raw request bodies: JSON as read by the mock app's parser (`verify`),
 * other bodies once the upstream proxy read them. Kept per request so the
 * log and the upstream see the bytes the client sent.
 */
const rawBodies = new WeakMap<IncomingMessage, Buffer>();

export function rememberRawBody(req: IncomingMessage, body: Buffer): void {
	rawBodies.set(req, body);
}

export function rawBodyOf(req: IncomingMessage): Buffer | undefined {
	return rawBodies.get(req);
}

/** Collects the first `LOG_BODY_LIMIT` bytes of what is written. */
class BodyTap {
	private readonly chunks: Buffer[] = [];
	private kept = 0;
	size = 0;

	add(chunk: unknown, encoding: unknown): void {
		let bytes: Buffer;
		if (typeof chunk === "string") {
			bytes = Buffer.from(
				chunk,
				typeof encoding === "string" && Buffer.isEncoding(encoding)
					? encoding
					: "utf8",
			);
		} else if (chunk instanceof Uint8Array) {
			bytes = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
		} else {
			return;
		}
		this.size += bytes.length;
		const room = LOG_BODY_LIMIT - this.kept;
		if (room <= 0) return;
		const part = bytes.subarray(0, room);
		this.chunks.push(Buffer.from(part));
		this.kept += part.length;
	}

	bytes(): Buffer {
		return Buffer.concat(this.chunks);
	}
}

function responseHeaders(res: Response): HeaderEntry[] {
	return Object.entries(res.getHeaders()).flatMap(([name, value]) => {
		if (value === undefined) return [];
		const values = Array.isArray(value) ? value : [String(value)];
		return values.map((v) => ({ name, value: v }));
	});
}

const sources = new WeakMap<Response, RequestLogSource>();

/** Who answers this request (default `mock`). */
export function setLogSource(res: Response, source: RequestLogSource): void {
	sources.set(res, source);
}

/** Line fields a handler knows beyond the exchange (the inbox). */
export type LogExtras = Pick<RequestLogInput, "id" | "inbox" | "target">;

const extras = new WeakMap<Response, LogExtras>();

/** Adds `extras` to the line this response will be logged as. */
export function setLogExtras(res: Response, value: LogExtras): void {
	extras.set(res, value);
}

/**
 * Logs the exchange once the response is sent: the request as the client
 * sent it (minus the headers nginx and Cloudflare add), the response as
 * sent, both bodies cut at 64 KB by the service. Only admitted requests
 * of a resolved project are tracked, so log lines never outnumber the
 * requests counted against the owner's quota.
 */
export function trackRequestLog(
	req: Request,
	res: Response,
	project: MockProject,
	address: MockAddress,
	log: RequestLogService,
): void {
	const started = performance.now();
	const at = new Date();
	const tap = new BodyTap();
	const write = res.write;
	const end = res.end;
	res.write = function (this: Response, ...args: unknown[]): boolean {
		tap.add(args[0], args[1]);
		return Reflect.apply(write, this, args);
	} as Response["write"];
	res.end = function (this: Response, ...args: unknown[]): Response {
		if (typeof args[0] !== "function") tap.add(args[0], args[1]);
		return Reflect.apply(end, this, args);
	} as Response["end"];
	const query = req.originalUrl.split("?").slice(1).join("?");
	let logged = false;
	const record = (): void => {
		if (logged) return;
		logged = true;
		const raw = rawBodyOf(req);
		log.record({
			projectId: project.id,
			ownerPlan: project.ownerPlan,
			redactHeaders: project.redactHeaders,
			at,
			method: req.method,
			path: address.rawPath,
			query,
			status: res.statusCode,
			ms: performance.now() - started,
			source: sources.get(res) ?? "mock",
			request: {
				headers: fromRawHeaders(req.rawHeaders).filter(
					(h) => !isInfrastructureHeader(h.name),
				),
				body: raw ? { bytes: raw, size: raw.length } : null,
			},
			response: {
				headers: responseHeaders(res),
				body: { bytes: tap.bytes(), size: tap.size },
			},
			...extras.get(res),
		});
	};
	// `finish`: the whole response was handed to the socket; `close`
	// alone: the client went away first.
	res.once("finish", record);
	res.once("close", record);
}
