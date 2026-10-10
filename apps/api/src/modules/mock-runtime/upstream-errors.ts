import type { Response } from "express";
import { messagesFor } from "../../i18n/server-messages.js";
import { readUserLocale } from "../users/user-locale.js";
import type { ProjectUpstream } from "./upstream-config.js";
import {
	MAX_FORWARD_RESPONSE_BYTES,
	type OutboundFailure,
} from "./upstream-forwarder.js";

/** Why the upstream gave no usable answer (`error.details.cause`). */
export type UpstreamFailure =
	| OutboundFailure
	| "no_tunnel"
	| "too_large"
	| "busy"
	| "loop";

/**
 * Body of a failed upstream exchange: the runtime's `{ error: { code,
 * message, details } }` with `hint` beside them, the command that brings
 * a tunnel back (`tunelo http <port>`), for tunnel upstreams only.
 */
export interface UpstreamErrorBody {
	readonly error: {
		readonly code: string;
		readonly message: string;
		readonly hint?: string;
		readonly details: {
			readonly cause: UpstreamFailure;
			readonly port?: number;
		};
	};
}

const STATUS_OF: Readonly<Record<UpstreamFailure, number>> = {
	no_tunnel: 502,
	blocked: 502,
	dns: 502,
	timeout: 502,
	connect: 502,
	too_large: 502,
	busy: 503,
	loop: 508,
};

const CODE_OF: Readonly<Record<UpstreamFailure, string>> = {
	no_tunnel: "UPSTREAM_UNAVAILABLE",
	blocked: "UPSTREAM_UNAVAILABLE",
	dns: "UPSTREAM_UNAVAILABLE",
	timeout: "UPSTREAM_UNAVAILABLE",
	connect: "UPSTREAM_UNAVAILABLE",
	too_large: "UPSTREAM_RESPONSE_TOO_LARGE",
	busy: "UPSTREAM_BUSY",
	loop: "UPSTREAM_LOOP",
};

const MB = Math.round(MAX_FORWARD_RESPONSE_BYTES / (1024 * 1024));

/** The message in the project owner's language (the hybrid mock's author). */
async function messageOf(
	owner: string,
	cause: UpstreamFailure,
	upstream: ProjectUpstream,
): Promise<string> {
	const texts = messagesFor(await readUserLocale(owner)).traffic;
	const port = upstream.kind === "tunnel" ? upstream.port : null;
	switch (cause) {
		case "no_tunnel":
			return texts.tunnelMissing({ port: port ?? 0 });
		case "blocked":
			return texts.blocked;
		case "too_large":
			return texts.responseTooLarge({ mb: MB });
		case "busy":
			return texts.busy;
		case "loop":
			return texts.loop;
		default:
			return port === null ? texts.unreachable : texts.tunnelDown({ port });
	}
}

/** Answers a failed upstream exchange (`Retry-After: 1` when busy). */
export async function sendUpstreamError(
	res: Response,
	owner: string,
	upstream: ProjectUpstream,
	cause: UpstreamFailure,
): Promise<void> {
	const tunnel = upstream.kind === "tunnel" ? upstream.port : null;
	const code = CODE_OF[cause];
	const hinted = tunnel !== null && code === "UPSTREAM_UNAVAILABLE";
	const body: UpstreamErrorBody = {
		error: {
			code,
			message: await messageOf(owner, cause, upstream),
			...(hinted ? { hint: `tunelo http ${tunnel}` } : {}),
			details: { cause, ...(tunnel === null ? {} : { port: tunnel }) },
		},
	};
	if (res.headersSent) return;
	if (cause === "busy") res.setHeader("Retry-After", "1");
	res.status(STATUS_OF[cause]).json(body);
}
