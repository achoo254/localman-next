import { OperationError } from "@localman/operations";
import { z } from "zod";
import {
	DENIED_PORTS,
	FORWARD_ERRORS,
	FORWARD_ERROR_HEADER,
	FORWARD_HEADERS,
} from "./machine-forward-contract.js";
import { reachableMachine } from "./machine-targets.js";
import { tuneloRuntime } from "./tunelo-runtime.js";

const CALL_TIMEOUT_MS = 5_000;
const MAX_PORTS = 200;

/** `GET <forwardUrl>/ports` as the machine answers it. */
const portList = z.object({
	ports: z
		.array(
			z.object({
				port: z.number().int().min(1).max(65_535),
				/** Process listening there, when the machine could tell. */
				name: z.string().nullable().optional(),
			}),
		)
		.max(MAX_PORTS),
});

/** A process name as the user (and an agent) reads it: no control characters. */
function displayName(raw: string | null | undefined): string | null {
	if (!raw) return null;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
	const clean = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
	return clean === "" ? null : clean.slice(0, 100);
}

export interface MachinePort {
	port: number;
	name: string | null;
}

function unavailable(code: string | null): OperationError {
	if (code === FORWARD_ERRORS.offline) {
		return new OperationError(
			502,
			"MACHINE_OFFLINE",
			"The machine is offline: start `tunelo` on it",
		);
	}
	if (code === FORWARD_ERRORS.disabled) {
		return new OperationError(
			409,
			"MACHINE_FORWARD_DISABLED",
			"The machine turned forwarding off (`tunelo config local-forward on`)",
		);
	}
	return new OperationError(
		502,
		"MACHINE_UNAVAILABLE",
		"The machine did not list its ports; update `tunelo` on it",
	);
}

/**
 * Loopback ports listening on the user's own machine `id`, asked through
 * its machine tunnel with the link token. Deny-listed ports are left out
 * (the machine leaves out its own too).
 */
export async function listMachinePorts(
	userSub: string,
	id: string,
): Promise<{ ports: MachinePort[] }> {
	const { token, forwardUrl } = await reachableMachine(userSub, id);
	const runtime = tuneloRuntime();
	let response: Awaited<ReturnType<typeof runtime.fetch>>;
	try {
		response = await runtime.fetch(`${forwardUrl}/ports`, {
			method: "GET",
			headers: {
				accept: "application/json",
				[FORWARD_HEADERS.access]: token,
			},
			redirect: "error",
			signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
		});
	} catch {
		throw unavailable(null);
	}
	if (!response.ok) {
		throw unavailable(response.headers.get(FORWARD_ERROR_HEADER));
	}
	const parsed = portList.safeParse(await response.json().catch(() => null));
	if (!parsed.success) throw unavailable(null);
	const seen = new Set<number>();
	const ports: MachinePort[] = [];
	for (const item of parsed.data.ports) {
		if (DENIED_PORTS.has(item.port) || seen.has(item.port)) continue;
		seen.add(item.port);
		ports.push({ port: item.port, name: displayName(item.name) });
	}
	ports.sort((a, b) => a.port - b.port);
	return { ports };
}
