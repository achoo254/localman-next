import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { requireSubject } from "../../http/require-auth.js";
import { listMachinePorts as readPorts } from "./machine-ports-service.js";
import { listOwnMachines } from "./machine-targets.js";
import {
	LINK_EXEMPT,
	TUNELO_MACHINE_ABOUT,
	tuneloOperationBase,
	tunnelLinkView,
} from "./tunelo-view.js";
import { setMachineForward as setForward } from "./tunnel-self-link-service.js";

const machineId = z.string().min(1).max(64);
const READ = { readOnly: true, destructive: false, idempotent: true } as const;

const machineView = z.object({
	/** Pass as `machine` to send_request. */
	id: z.string(),
	name: z.string(),
	/** Requests to its localhost are on in Localman (`setMachineForward`). */
	forwardEnabled: z.boolean(),
	/** The machine revoked its link: run `tunelo login` on it again. */
	revoked: z.boolean(),
	linkedAt: z.string(),
});

export const listMachines = defineOperation({
	...tuneloOperationBase,
	id: "client.listMachines",
	method: "GET",
	path: "/client/machines",
	summary: "List the user's own machines whose localhost Localman can reach",
	description: `${TUNELO_MACHINE_ABOUT} Answers each machine's id (the \`machine\` of send_request), name, whether requests to it are on and whether its link was revoked.`,
	input: z.object({}),
	output: z.object({ machines: z.array(machineView) }),
	annotations: READ,
	mcp: true,
	handler: async (ctx) => listOwnMachines(requireSubject(ctx)),
});

export const listMachinePorts = defineOperation({
	...tuneloOperationBase,
	id: "client.listMachinePorts",
	method: "GET",
	path: "/client/machines/:id/ports",
	summary: "List the loopback ports listening on one of the user's machines",
	description: `${TUNELO_MACHINE_ABOUT} Asks the machine itself (5-second limit). Ports never forwarded (debuggers, Docker, DevTools, the machine's own) are left out; any other port may still be sent to. 404 MACHINE_NOT_FOUND, 409 MACHINE_FORWARD_OFF or MACHINE_FORWARD_DISABLED, 502 MACHINE_OFFLINE or MACHINE_UNAVAILABLE.`,
	input: z.object({ id: machineId }),
	output: z.object({
		ports: z.array(
			z.object({ port: z.number().int(), name: z.string().nullable() }),
		),
	}),
	annotations: READ,
	mcp: true,
	handler: async (ctx, input) => readPorts(requireSubject(ctx), input.id),
});

export const setMachineForward = defineOperation({
	...tuneloOperationBase,
	id: "client.setMachineForward",
	method: "PATCH",
	path: "/client/tunnel-links/:id",
	summary: "Turn Localman's requests to a machine's localhost on or off",
	description: `${TUNELO_MACHINE_ABOUT} Own machines linked by \`tunelo login\` only (404 otherwise). Answers the machine as the linked machines list shows it.`,
	input: z.object({ id: machineId, forwardEnabled: z.boolean() }),
	output: tunnelLinkView,
	annotations: { readOnly: false, destructive: false, idempotent: true },
	mcp: { exempt: LINK_EXEMPT },
	handler: async (ctx, input) =>
		setForward(requireSubject(ctx), input.id, input.forwardEnabled),
});
