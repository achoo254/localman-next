import { OperationError } from "@localman/operations";
import type { ElementRole } from "@localman/shared/access";
import { getNotificationService } from "../notifications/notification-runtime.js";
import { requireElement } from "./access-policy.js";
import {
	AccessRequestModel,
	type StoredAccessRequest,
} from "./access-request-model.js";
import { findRequest, requestNotFound } from "./access-request-service.js";
import {
	type AccessRequestView,
	toAccessRequestView,
} from "./access-request-view.js";
import { elementPath } from "./element-access-view.js";
import type { ElementRecord } from "./element-adapters.js";
import { assertShareable, grantElementRole } from "./share-service.js";

/**
 * What the Editor decided. An approval names the role it saw: the
 * requester may have upgraded the request since.
 */
export type AccessDecision =
	| { readonly approve: true; readonly role: ElementRole }
	| { readonly approve: false };

/** The request was resolved, or upgraded after the approver read it. */
async function conflictOf(row: StoredAccessRequest): Promise<OperationError> {
	const current = await AccessRequestModel.findById(row._id, {
		status: 1,
	}).lean<{ status: string }>();
	return current?.status === "pending"
		? new OperationError(
				409,
				"REQUEST_CHANGED",
				"The request changed; open it again",
			)
		: new OperationError(
				409,
				"ALREADY_RESOLVED",
				"This request was already approved or denied",
			);
}

/**
 * Approves (shares the element with the requester in the role the approver
 * saw, raising any share they hold) or denies a pending request, then
 * tells the requester. The caller manages roles on the element. 409
 * `ALREADY_RESOLVED` when it was resolved, `REQUEST_CHANGED` when its
 * role is no longer the one approved.
 */
export async function resolveAccessRequest(
	sub: string,
	requestId: string,
	decision: AccessDecision,
): Promise<AccessRequestView> {
	const { approve } = decision;
	const row = await findRequest(requestId);
	const access = await requireElement(
		sub,
		row.elementType,
		row.elementId,
		"manageRoles",
	).catch((error: unknown) => {
		throw error instanceof OperationError && error.status === 404
			? requestNotFound()
			: error;
	});
	const { element } = access;
	if (approve) await assertShareable(element);
	const resolved = await AccessRequestModel.findOneAndUpdate(
		{
			_id: row._id,
			status: "pending",
			...(decision.approve ? { role: decision.role } : {}),
		},
		{
			$set: {
				status: approve ? "approved" : "denied",
				resolvedBy: sub,
				resolvedAt: new Date(),
			},
		},
		{ returnDocument: "after" },
	).lean<StoredAccessRequest>();
	if (!resolved) throw await conflictOf(row);
	if (approve) await grantOrReopen(element, resolved, sub);
	getNotificationService().notifyLater(resolved.requesterId, {
		type: "access.resolved",
		params: {
			elementType: element.type,
			element: element.name,
			role: resolved.role,
			approved: approve,
		},
		link: elementPath(element),
	});
	return toAccessRequestView(resolved, element);
}

/** Grants the approved role; on failure the request is pending again. */
async function grantOrReopen(
	element: ElementRecord,
	request: StoredAccessRequest,
	approver: string,
): Promise<void> {
	try {
		await grantElementRole(
			element,
			{ userId: request.requesterId },
			request.role,
			approver,
		);
	} catch (error) {
		await AccessRequestModel.updateOne(
			{ _id: request._id },
			{
				$set: { status: "pending" },
				$unset: { resolvedBy: 1, resolvedAt: 1 },
			},
		);
		throw error;
	}
}
