import { AsyncResource } from "node:async_hooks";
import { OperationError } from "@localman/operations";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { trackOutbound } from "../mock-callbacks/outbound-tracking.js";
import {
	setLogExtras,
	setLogSource,
} from "../mock-runtime/request-log-capture.js";
import type {
	MockAddress,
	MockProject,
} from "../mock-runtime/resolve-project.js";
import {
	SOURCE_HEADER,
	UPSTREAM_HOP_HEADER,
} from "../mock-runtime/upstream-headers.js";
import { readForwardBody } from "../mock-runtime/upstream-proxy.js";
import { enqueueInboxForward } from "./forward-service.js";
import { InboxModel, type StoredInbox } from "./inbox-model.js";
import {
	INBOX_NAME,
	INBOX_SEGMENT,
	forwardLabel,
	inboxContentTypeOf,
} from "./inbox-schema.js";

/** `/_inbox/…` below the secret (outside the project prefix). */
export function isInboxAddress(address: MockAddress): boolean {
	return address.segments[0] === INBOX_SEGMENT;
}

function sendError(res: Response, status: number, code: string, text: string) {
	res.status(status).json(new OperationError(status, code, text).toBody());
}

async function findInbox(
	project: MockProject,
	address: MockAddress,
): Promise<StoredInbox | null> {
	const [, name, ...rest] = address.segments;
	if (name === undefined || rest.length > 0 || !INBOX_NAME.test(name)) {
		return null;
	}
	return InboxModel.findOne({
		projectId: project.id,
		name,
	}).lean<StoredInbox>();
}

/**
 * Webhook inbox of the mock runtime: any method to `/_inbox/<name>` gets
 * the inbox's response at once (`X-Localman-Source: inbox`) and is logged
 * with source `inbox` (the request was already counted and is tracked by
 * the router). With a forward, a copy is queued once the response is
 * sent, unless the request itself came from a Localman delivery
 * (`X-Localman-Hop`). Unknown inbox: 404 `NOT_FOUND`; a body over the
 * runtime's 100 KB: 413 `PAYLOAD_TOO_LARGE`.
 */
export async function serveInbox(
	req: Request,
	res: Response,
	project: MockProject,
	address: MockAddress,
): Promise<void> {
	setLogSource(res, "inbox");
	res.setHeader(SOURCE_HEADER, "inbox");
	const inbox = await findInbox(project, address);
	if (!inbox) return sendError(res, 404, "NOT_FOUND", "Inbox not found");
	const body = await readForwardBody(req);
	if (body === "too_large") {
		return sendError(
			res,
			413,
			"PAYLOAD_TOO_LARGE",
			"Request body is too large",
		);
	}
	const looped = req.headers[UPSTREAM_HOP_HEADER.toLowerCase()] !== undefined;
	const forward = looped ? null : inbox.forward;
	const lineId = new Types.ObjectId();
	setLogExtras(res, {
		id: lineId,
		inbox: inbox.name,
		...(forward ? { target: forwardLabel(forward) } : {}),
	});
	if (forward) {
		// After the router's log listener: the line exists before its
		// forward can complete it.
		// Bound to the request's async context: the job is the tenant's.
		res.once(
			"finish",
			AsyncResource.bind(() => {
				const request = { projectId: project.id, inboxId: inbox._id, forward };
				trackOutbound(enqueueInboxForward(req, { ...request, lineId, body }));
			}),
		);
	}
	const { status, contentType, body: answer } = inbox.response;
	res.status(status).setHeader("Content-Type", inboxContentTypeOf(contentType));
	res.send(answer);
}
