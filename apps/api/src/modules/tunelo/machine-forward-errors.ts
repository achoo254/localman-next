import { OperationError } from "@localman/operations";
import type { ClientResponse } from "@localman/shared/api-client";
import {
	FORWARD_ERRORS,
	FORWARD_ERROR_HEADER,
} from "./machine-forward-contract.js";
import { TuneloApiError } from "./tunelo-api.js";
import { TunnelLinkModel } from "./tunelo-link-model.js";
import { tuneloRuntime } from "./tunelo-runtime.js";

interface Refusal {
	/** The status Tunelo or the machine answers with this code. */
	readonly from: number;
	readonly status: number;
	readonly code: string;
	readonly message: string;
}

/** What the API answers for each refusal of Tunelo or the machine. */
const REFUSALS: Readonly<Record<string, Refusal>> = {
	[FORWARD_ERRORS.offline]: {
		from: 502,
		status: 502,
		code: "MACHINE_OFFLINE",
		message: "The machine is offline: start `tunelo` on it, then send again",
	},
	[FORWARD_ERRORS.portBlocked]: {
		from: 403,
		status: 403,
		code: "MACHINE_PORT_BLOCKED",
		message:
			"This port is never forwarded (debuggers, admin and automation ports, Docker, the machine's own ports)",
	},
	[FORWARD_ERRORS.disabled]: {
		from: 403,
		status: 409,
		code: "MACHINE_FORWARD_DISABLED",
		message:
			"The machine turned forwarding off (`tunelo config local-forward on` turns it back on)",
	},
	[FORWARD_ERRORS.badPort]: {
		from: 400,
		status: 400,
		code: "MACHINE_BAD_PORT",
		message: "Invalid port",
	},
	[FORWARD_ERRORS.portClosed]: {
		from: 502,
		status: 502,
		code: "MACHINE_PORT_CLOSED",
		message: "Nothing listens on this port of the machine",
	},
	[FORWARD_ERRORS.rateLimited]: {
		from: 429,
		status: 429,
		code: "MACHINE_RATE_LIMITED",
		message: "Too many requests to this machine; try again in a minute",
	},
};

const REVOKED = new OperationError(
	409,
	"MACHINE_LINK_REVOKED",
	"The machine revoked its link; run `tunelo login` on it again",
);

function refusalCodeOf(response: ClientResponse): string | null {
	const header = response.headers.find(
		(h) => h.name.toLowerCase() === FORWARD_ERROR_HEADER,
	);
	return header?.value.trim() ?? null;
}

/**
 * Whether Tunelo itself refuses the link token now (401/403 from
 * `GET /api/links/self`). A 404 with the code may come from the app on the
 * machine; only Tunelo's word marks the link dead.
 */
async function tuneloRefuses(token: string): Promise<boolean> {
	try {
		await tuneloRuntime().api().selfLinkInfo(token);
		return false;
	} catch (error) {
		if (error instanceof TuneloApiError) return error.unauthorized;
		throw error;
	}
}

/**
 * Turns a refusal of Tunelo or the machine into an API error, when the
 * answer came from the machine's tunnel (not after a redirect elsewhere)
 * with the status that code comes with. Anything else is the app's own
 * answer and is returned as it is.
 */
export async function checkMachineAnswer(
	userSub: string,
	route: {
		readonly machine: string;
		readonly tunnel: string | null;
		readonly token: string;
	},
	response: ClientResponse,
): Promise<void> {
	if (!URL.canParse(response.finalUrl)) return;
	if (new URL(response.finalUrl).origin !== route.tunnel) return;
	const code = refusalCodeOf(response);
	if (code === null) return;
	if (code === FORWARD_ERRORS.notFound) {
		if (response.status !== 404 || !(await tuneloRefuses(route.token))) return;
		await TunnelLinkModel.updateOne(
			{ _id: route.machine, userSub },
			{ deadAt: new Date() },
		);
		tuneloRuntime().cache.drop(userSub);
		throw REVOKED;
	}
	const refusal = REFUSALS[code];
	if (!refusal || refusal.from !== response.status) return;
	throw new OperationError(refusal.status, refusal.code, refusal.message, {
		machine: route.machine,
	});
}
