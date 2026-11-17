/**
 * Requests for `localhost:<port>` on a machine, sent by an app the
 * machine's owner linked (Localman) to `<machine tunnel>/.tunelo/forward/…`.
 * Only a link token the owner minted for this very machine passes; anyone
 * else gets the same 404 whether the machine is online or not. The machine
 * serves the path only when it carries `tunelo-forward-granted`, which only
 * this gate sets: every client-sent `tunelo-*` header is dropped first.
 */
import {
	LOCAL_FORWARD,
	LOCAL_FORWARD_ERRORS,
	LOCAL_FORWARD_HEADERS,
	SERVER_TOKEN_PREFIX,
	isDeniedForwardPort,
	parseLocalPort,
	stripTuneloHeaders,
} from "@tunelo/shared";
import type { TokenAuthenticator } from "./auth/token-authenticator.js";
import { isMachineSubdomain, machineSubdomain } from "./machine-subdomain.js";

type Headers = Record<string, string | string[]>;

const MAX_TOKEN_LENGTH = 512;

/** Every `tunelo-*` header from the client: only the relay sets them. */
const CLIENT_FORWARD_HEADERS: ReadonlySet<string> = new Set(
	Object.values(LOCAL_FORWARD_HEADERS),
);

/**
 * Request headers as relayed to a tunnel. A machine tunnel loses every
 * `tunelo-*` header; any other tunnel loses the forward ones, so no app
 * ever sees a grant it could mistake for the relay's.
 */
export function relayedHeaders(subdomain: string, headers: Headers): Headers {
	if (isMachineSubdomain(subdomain)) return stripTuneloHeaders(headers);
	const out: Headers = {};
	for (const [name, value] of Object.entries(headers)) {
		if (!CLIENT_FORWARD_HEADERS.has(name.toLowerCase())) out[name] = value;
	}
	return out;
}

export type ForwardDecision =
	| { ok: true; headers: Headers; port: number | null }
	| { ok: false; status: number; code: string; port: number | null };

function single(value: string | string[] | undefined): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function refuse(
	status: number,
	code: string,
	port: number | null = null,
): ForwardDecision {
	return { ok: false, status, code, port };
}

const NOT_FOUND = refuse(404, LOCAL_FORWARD_ERRORS.NOT_FOUND);

/** Whether the link token is the owner's, minted for this machine. */
async function ownsMachine(
	authenticator: TokenAuthenticator,
	token: string | undefined,
	subdomain: string,
): Promise<boolean> {
	if (
		!token?.startsWith(SERVER_TOKEN_PREFIX) ||
		token.length > MAX_TOKEN_LENGTH
	) {
		return false;
	}
	const outcome = await authenticator.authenticate(token, null);
	if (!outcome.ok) return false;
	const { kind, scopes, linkedOwnerSub, linkedDeviceId } = outcome.keyInfo;
	return (
		kind === "link" &&
		scopes.includes(LOCAL_FORWARD.SCOPE) &&
		Boolean(linkedOwnerSub && linkedDeviceId) &&
		machineSubdomain(linkedOwnerSub ?? "", linkedDeviceId ?? "") === subdomain
	);
}

/**
 * Decides a request under `LOCAL_FORWARD.PATH` of `subdomain`. `online`
 * tells whether the machine's tunnel is connected (or reconnecting).
 */
export async function gateLocalForward(input: {
	authenticator: TokenAuthenticator | undefined;
	subdomain: string;
	headers: Headers;
	online: boolean;
}): Promise<ForwardDecision> {
	const { authenticator, subdomain, headers } = input;
	if (!authenticator || !isMachineSubdomain(subdomain)) return NOT_FOUND;
	const token = single(headers[LOCAL_FORWARD_HEADERS.ACCESS]);
	if (!(await ownsMachine(authenticator, token, subdomain))) return NOT_FOUND;

	const rawPort = headers[LOCAL_FORWARD_HEADERS.LOCAL_PORT];
	const port = rawPort === undefined ? null : parseLocalPort(rawPort);
	if (rawPort !== undefined && port === null) {
		return refuse(400, LOCAL_FORWARD_ERRORS.BAD_PORT);
	}
	if (port !== null && isDeniedForwardPort(port)) {
		return refuse(403, LOCAL_FORWARD_ERRORS.PORT_BLOCKED, port);
	}
	if (!input.online) {
		return refuse(502, LOCAL_FORWARD_ERRORS.MACHINE_OFFLINE, port);
	}
	const granted: Headers = {
		...stripTuneloHeaders(headers),
		[LOCAL_FORWARD_HEADERS.GRANTED]: "1",
	};
	// No port: a request to the machine itself (`GET …/ports`).
	if (port !== null) granted[LOCAL_FORWARD_HEADERS.LOCAL_PORT] = String(port);
	return { ok: true, headers: granted, port };
}

/** Answers a refused forward; the code also goes in a header. */
export function writeForwardRefusal(
	res: {
		writeHead(status: number, headers: Record<string, string>): unknown;
		end(body: string): unknown;
	},
	decision: Extract<ForwardDecision, { ok: false }>,
): void {
	res.writeHead(decision.status, {
		"content-type": "application/json",
		"cache-control": "no-store",
		[LOCAL_FORWARD_HEADERS.ERROR]: decision.code,
	});
	res.end(
		JSON.stringify({
			error: {
				code: decision.code,
				message: decision.status === 404 ? "Not found" : "Forward refused",
			},
		}),
	);
}
