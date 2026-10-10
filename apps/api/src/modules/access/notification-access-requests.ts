import { ELEMENT_ROLES, type ElementRole } from "@localman/shared/access";
import { Types } from "mongoose";
import { z } from "zod";
import { NotificationModel } from "../notifications/notification-model.js";
import {
	AccessRequestModel,
	type AccessRequestStatus,
} from "./access-request-model.js";

/** The access request an `access.requested` notification is about. */
export interface NotifiedAccessRequest {
	readonly id: string;
	readonly status: AccessRequestStatus;
	/** The role asked for now (a pending request can be upgraded). */
	readonly role: ElementRole;
	/**
	 * The role this notification announced (its body says it). Approving
	 * from the notification sends this one, so an upgrade made since is
	 * refused with `REQUEST_CHANGED` instead of approved unseen.
	 */
	readonly notifiedRole: ElementRole;
}

export const notifiedAccessRequest = z
	.object({
		id: z.string(),
		status: z.enum(["pending", "approved", "denied"]),
		role: z.enum(ELEMENT_ROLES),
		notifiedRole: z.enum(ELEMENT_ROLES),
	})
	.nullable();

const requestParams = z.object({
	requestId: z.string(),
	role: z.enum(ELEMENT_ROLES),
});

/**
 * Adds `accessRequest` to notification items: the request, its status and
 * current role for `access.requested`, plus the role the notification
 * itself announced (the bell shows Approve/Deny only while it is pending
 * and approves the announced role), `null` for every other type and for
 * requests purged since.
 * Two queries for the whole page, whatever its size.
 */
export async function withAccessRequests<
	T extends { readonly id: string; readonly type: string },
>(
	items: readonly T[],
): Promise<(T & { accessRequest: NotifiedAccessRequest | null })[]> {
	const ids = items
		.filter((item) => item.type === "access.requested")
		.map((item) => item.id)
		.filter((id) => Types.ObjectId.isValid(id));
	const requestOf = new Map<
		string,
		{ requestId: string; notifiedRole: ElementRole }
	>();
	if (ids.length > 0) {
		const docs = await NotificationModel.find(
			{ _id: { $in: ids } },
			{ params: 1 },
		).lean<{ _id: Types.ObjectId; params?: unknown }[]>();
		for (const doc of docs) {
			const params = requestParams.safeParse(doc.params);
			if (params.success && Types.ObjectId.isValid(params.data.requestId)) {
				requestOf.set(doc._id.toHexString(), {
					requestId: params.data.requestId,
					notifiedRole: params.data.role,
				});
			}
		}
	}
	const statuses = new Map<
		string,
		{ status: AccessRequestStatus; role: ElementRole }
	>();
	if (requestOf.size > 0) {
		const requests = await AccessRequestModel.find(
			{
				_id: {
					$in: [...new Set([...requestOf.values()].map((r) => r.requestId))],
				},
			},
			{ status: 1, role: 1 },
		).lean<
			{ _id: Types.ObjectId; status: AccessRequestStatus; role: ElementRole }[]
		>();
		for (const { _id, status, role } of requests) {
			statuses.set(_id.toHexString(), { status, role });
		}
	}
	return items.map((item) => {
		const notified = requestOf.get(item.id);
		const current = notified ? statuses.get(notified.requestId) : undefined;
		return {
			...item,
			accessRequest:
				notified && current
					? {
							id: notified.requestId,
							...current,
							notifiedRole: notified.notifiedRole,
						}
					: null,
		};
	});
}
