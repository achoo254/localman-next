import { OperationError } from "@localman/operations";
import type {
	ElementRole,
	ShareableElementType,
} from "@localman/shared/access";
import { Types } from "mongoose";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { takeRateLimitSlot } from "../../lib/rate-limit-windows.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import { findWorkspaceById } from "../workspaces/workspace-roles.js";
import { canOnElement, elementRoleOf, loadElement } from "./access-policy.js";
import {
	AccessRequestModel,
	type StoredAccessRequest,
} from "./access-request-model.js";
import {
	type AccessRequestView,
	toAccessRequestView,
} from "./access-request-view.js";
import { displayNameOf } from "./display-name.js";
import type { ElementRecord } from "./element-adapters.js";
import { elementEditors } from "./element-editors.js";

/** Requests one account may send, whatever the element (no Editor spam). */
const REQUEST_RATE_LIMIT = { max: 20, windowMs: 60 * 60_000 };

export interface AccessRequestInput {
	readonly type: ShareableElementType;
	readonly id: string;
	readonly role: ElementRole;
	readonly message?: string;
}

function holds(current: ElementRole | null, wanted: ElementRole): boolean {
	return current === "editor" || current === wanted;
}

/**
 * "Request access" / "Request to edit". Answers the same whether or not
 * the element exists, so the caller learns nothing about it; only a
 * caller who already holds the role is told (409 `ALREADY_HAS_ACCESS`).
 * Elements of a personal workspace (or of one that is gone) cannot be
 * shared, so nothing is stored for them. One pending request per person and element: a repeat asking
 * to edit upgrades a pending view request (Editors are told again), any
 * other repeat changes nothing. The element's Editors are notified.
 */
export async function requestAccess(
	sub: string,
	input: AccessRequestInput,
): Promise<void> {
	if (!(await takeRateLimitSlot("access-request", sub, REQUEST_RATE_LIMIT))) {
		throw new OperationError(
			429,
			"RATE_LIMITED",
			"Too many access requests; try again later",
		);
	}
	const element = await loadElement(input.type, input.id);
	if (!element) return;
	if (holds(await elementRoleOf(sub, element), input.role)) {
		throw new OperationError(
			409,
			"ALREADY_HAS_ACCESS",
			"You already have this access",
		);
	}
	const workspace = await findWorkspaceById(element.workspaceId.toHexString());
	// Personal-workspace elements and orphans cannot be shared: store nothing.
	if (workspace?.type !== "team") return;
	const request = await storeRequest(sub, element, input);
	if (request) await notifyEditors(element, request);
}

/**
 * Stores the pending request, or upgrades the caller's pending Viewer
 * request when they now ask to edit (with their new message, if any).
 * Returns the request the Editors must hear about, `null` when nothing
 * changed. The upgrade matches `role: "viewer"`, so of two concurrent
 * upgrades only one notifies.
 */
async function storeRequest(
	sub: string,
	element: ElementRecord,
	input: AccessRequestInput,
): Promise<StoredAccessRequest | null> {
	const key = {
		elementType: element.type,
		elementId: element.id,
		requesterId: sub,
	};
	try {
		const created = await AccessRequestModel.create({
			...key,
			role: input.role,
			message: input.message,
			status: "pending",
		});
		return created.toObject<StoredAccessRequest>();
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
	}
	if (input.role !== "editor") return null;
	return AccessRequestModel.findOneAndUpdate(
		{ ...key, status: "pending", role: "viewer" },
		{
			$set: {
				role: "editor",
				...(input.message ? { message: input.message } : {}),
			},
		},
		{ returnDocument: "after" },
	).lean<StoredAccessRequest>();
}

async function notifyEditors(
	element: ElementRecord,
	request: StoredAccessRequest,
): Promise<void> {
	const requester = await displayNameOf(request.requesterId);
	// A request outlives nothing but its account; a gone account asks nobody.
	if (requester === null) return;
	const requestId = request._id.toHexString();
	const notifications = getNotificationService();
	for (const editor of await elementEditors(element, request.requesterId)) {
		notifications.notifyLater(editor, {
			type: "access.requested",
			params: {
				requester,
				elementType: element.type,
				element: element.name,
				role: request.role,
				requestId,
			},
			link: `/access-requests/${requestId}`,
		});
	}
}

export function requestNotFound(): OperationError {
	return new OperationError(404, "NOT_FOUND", "Access request not found");
}

export async function findRequest(
	requestId: string,
): Promise<StoredAccessRequest> {
	const row = Types.ObjectId.isValid(requestId)
		? await AccessRequestModel.findById(requestId).lean<StoredAccessRequest>()
		: null;
	if (!row) throw requestNotFound();
	return row;
}

/** An access request, for the Editors of its element only (404 otherwise). */
export async function getAccessRequest(
	sub: string,
	requestId: string,
): Promise<AccessRequestView> {
	const row = await findRequest(requestId);
	const element = await loadElement(row.elementType, row.elementId);
	if (!element || !(await canOnElement(sub, element, "manageRoles"))) {
		throw requestNotFound();
	}
	return toAccessRequestView(row, element);
}
