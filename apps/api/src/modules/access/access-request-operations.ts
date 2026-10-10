import { defineOperation } from "@localman/operations";
import { ELEMENT_ROLES } from "@localman/shared/access";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { resolveAccessRequest } from "./access-request-resolution.js";
import { getAccessRequest, requestAccess } from "./access-request-service.js";
import { accessRequestView } from "./access-request-view.js";
import { elementParams } from "./element-access-view.js";

const requestId = z.string().min(1).max(64);
const RESOLVE_NOTE =
	"Needs the Editor role on the element (403 FORBIDDEN for Viewers; 404 NOT_FOUND for an unknown request or an element the caller holds no role on). 409 ALREADY_RESOLVED when it was already approved or denied. The requester is notified.";

export const requestElementAccessOperation = defineOperation({
	id: "sharing.requestElementAccess",
	method: "POST",
	path: "/elements/:elementType/:elementId/access-requests",
	summary: "Request access to a collection or environment",
	description:
		'"Request access" (role viewer) or "Request to edit" (role editor) with an optional message. Always answers `{ status: "sent" }`, whether or not the element exists, so nothing leaks about it; the element\'s Editors are notified and approve or deny. 409 ALREADY_HAS_ACCESS when the caller already holds the role. One pending request per person and element (a repeat changes nothing); at most 20 requests an hour (429 RATE_LIMITED).',
	input: z.object({
		...elementParams,
		role: z.enum(ELEMENT_ROLES),
		message: z.string().trim().max(500).optional(),
	}),
	output: z.object({ status: z.literal("sent") }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) => {
		await requestAccess(requireSubject(ctx), {
			type: input.elementType,
			id: input.elementId,
			role: input.role,
			message: input.message || undefined,
		});
		return { status: "sent" as const };
	},
});

export const getAccessRequestOperation = defineOperation({
	id: "sharing.getAccessRequest",
	method: "GET",
	path: "/access-requests/:requestId",
	summary: "Get an access request",
	description:
		"The element, the requester, the role asked for, the message and the status. Only Editors of the element see it (404 NOT_FOUND otherwise).",
	input: z.object({ requestId }),
	output: accessRequestView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) =>
		getAccessRequest(requireSubject(ctx), input.requestId),
});

export const approveAccessRequestOperation = defineOperation({
	id: "sharing.approveAccessRequest",
	method: "POST",
	path: "/access-requests/:requestId/approve",
	summary: "Approve an access request",
	description: `Shares the element with the requester in \`role\`, the role of the request as the approver saw it (an existing share is raised, never lowered). 409 REQUEST_CHANGED when the requester has since changed the request (open it again); 409 PERSONAL_WORKSPACE when the element sits in a personal workspace, WORKSPACE_MISSING when its workspace is gone. ${RESOLVE_NOTE}`,
	input: z.object({ requestId, role: z.enum(ELEMENT_ROLES) }),
	output: accessRequestView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) =>
		resolveAccessRequest(requireSubject(ctx), input.requestId, {
			approve: true,
			role: input.role,
		}),
});

export const denyAccessRequestOperation = defineOperation({
	id: "sharing.denyAccessRequest",
	method: "POST",
	path: "/access-requests/:requestId/deny",
	summary: "Deny an access request",
	description: `Closes the request without sharing; the requester may ask again. ${RESOLVE_NOTE}`,
	input: z.object({ requestId }),
	output: accessRequestView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, input) =>
		resolveAccessRequest(requireSubject(ctx), input.requestId, {
			approve: false,
		}),
});

export const accessRequestOperations = [
	requestElementAccessOperation,
	getAccessRequestOperation,
	approveAccessRequestOperation,
	denyAccessRequestOperation,
] as const;
