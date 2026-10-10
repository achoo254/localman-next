import {
	ELEMENT_ROLES,
	SHAREABLE_ELEMENT_TYPES,
} from "@localman/shared/access";
import { z } from "zod";
import { UserModel } from "../users/user-model.js";
import type { StoredAccessRequest } from "./access-request-model.js";
import type { ElementRecord } from "./element-adapters.js";

export const accessRequestView = z.object({
	id: z.string(),
	element: z.object({
		type: z.enum(SHAREABLE_ELEMENT_TYPES),
		id: z.string(),
		name: z.string(),
	}),
	/** `username` is `null` once the requester's account is gone. */
	requester: z.object({
		username: z.string().nullable(),
		name: z.string().nullable(),
		picture: z.string().nullable(),
	}),
	role: z.enum(ELEMENT_ROLES),
	message: z.string().nullable(),
	status: z.enum(["pending", "approved", "denied"]),
	createdAt: z.string(),
});
export type AccessRequestView = z.infer<typeof accessRequestView>;

export async function toAccessRequestView(
	row: StoredAccessRequest,
	element: ElementRecord,
): Promise<AccessRequestView> {
	const user = await UserModel.findOne({ sub: row.requesterId })
		.select("username name picture")
		.lean<{
			username: string;
			name?: string | null;
			picture?: string | null;
		}>();
	return {
		id: row._id.toHexString(),
		element: { type: element.type, id: element.id, name: element.name },
		requester: {
			username: user?.username ?? null,
			name: user?.name ?? null,
			picture: user?.picture ?? null,
		},
		role: row.role,
		message: row.message ?? null,
		status: row.status,
		createdAt: row.createdAt.toISOString(),
	};
}
