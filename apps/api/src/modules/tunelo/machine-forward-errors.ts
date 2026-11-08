import { OperationError } from "@localman/operations";
import type { ClientResponse } from "@localman/shared/api-client";
import {
	FORWARD_ERRORS,
	FORWARD_ERROR_HEADER,
} from "./machine-forward-contract.js";
import { TunnelLinkModel } from "./tunelo-link-model.js";
import { tuneloRuntime } from "./tunelo-runtime.js";

/** What the API answers for each refusal of Tunelo or the machine. */
const REFUSALS: Readonly<Record<string, [number, string, string]>> = {
	[FORWARD_ERRORS.offline]: [
		502,
		"MACHINE_OFFLINE",
		"The machine is offline: start `tunelo` on it, then send again",
	],
	[FORWARD_ERRORS.portBlocked]: [
		403,
		"MACHINE_PORT_BLOCKED",
		"This port is never forwarded (debuggers, Docker, DevTools and the machine's own ports)",
	],
	[FORWARD_ERRORS.disabled]: [
		409,
		"MACHINE_FORWARD_DISABLED",
		"The machine turned forwarding off (`tunelo config local-forward on` turns it back on)",
	],
	[FORWARD_ERRORS.badPort]: [400, "MACHINE_BAD_PORT", "Invalid port"],
	[FORWARD_ERRORS.portClosed]: [
		502,
		"MACHINE_PORT_CLOSED",
		"Nothing listens on this port of the machine",
	],
	[FORWARD_ERRORS.notFound]: [
		409,
		"MACHINE_LINK_REVOKED",
		"The machine revoked its link; run `tunelo login` on it again",
	],
};

function refusalCodeOf(response: ClientResponse): string | null {
	const header = response.headers.find(
		(h) => h.name.toLowerCase() === FORWARD_ERROR_HEADER,
	);
	return header?.value.trim() ?? null;
}

/**
 * Turns a refusal of Tunelo or the machine into an API error, when the
 * answer came from the machine's tunnel (not after a redirect elsewhere,
 * where any app may set the header). A link Tunelo no longer knows is
 * marked dead, like a list call that was refused.
 */
export async function checkMachineAnswer(
	userSub: string,
	route: { readonly machine: string; readonly tunnel: string | null },
	response: ClientResponse,
): Promise<void> {
	if (!URL.canParse(response.finalUrl)) return;
	if (new URL(response.finalUrl).origin !== route.tunnel) return;
	const code = refusalCodeOf(response);
	const refusal = code === null ? undefined : REFUSALS[code];
	if (!refusal) return;
	if (code === FORWARD_ERRORS.notFound) {
		await TunnelLinkModel.updateOne(
			{ _id: route.machine, userSub },
			{ deadAt: new Date() },
		);
		tuneloRuntime().cache.drop(userSub);
	}
	const [status, errorCode, message] = refusal;
	throw new OperationError(status, errorCode, message, {
		machine: route.machine,
	});
}
