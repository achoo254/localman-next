import { OperationError, defineOperation } from "@localman/operations";
import {
	CONTACT_CATEGORIES,
	CONTACT_SOURCES,
	CONTACT_STATUSES,
	type ContactStatus,
} from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE } from "../../http/require-auth.js";
import { ownerOnly } from "../users/owner-access.js";
import {
	ContactMessageModel,
	type StoredContactMessage,
} from "./contact-message-model.js";

const OWNER_NOTE =
	"Localman owners only (OWNER_SUBS); others get 403 before any input check.";
const OBJECT_ID = /^[a-f\d]{24}$/i;
const messageId = z.string().min(1).max(64);

const notFound = () =>
	new OperationError(404, "NOT_FOUND", "Message not found");

/** The contact message `id` names; 404 for anything else. */
async function requireMessage(id: string): Promise<StoredContactMessage> {
	const doc = OBJECT_ID.test(id)
		? await ContactMessageModel.findOne({
				_id: id,
				type: "contact",
			}).lean<StoredContactMessage>()
		: null;
	if (!doc) throw notFound();
	return doc;
}

const contactMessageItem = z.object({
	id: z.string(),
	category: z.enum(CONTACT_CATEGORIES),
	message: z.string(),
	name: z.string().nullable(),
	/** Email or Telegram `@username` to reply to; null when not given. */
	contact: z.string().nullable(),
	contactKind: z.enum(["email", "telegram"]).nullable(),
	source: z.enum(CONTACT_SOURCES),
	/** Signed-in sender; null for a guest. */
	userSub: z.string().nullable(),
	status: z.enum(CONTACT_STATUSES),
	createdAt: z.string(),
	readAt: z.string().nullable(),
	resolvedAt: z.string().nullable(),
});
type ContactMessageItem = z.input<typeof contactMessageItem>;

function toItem(doc: StoredContactMessage): ContactMessageItem {
	return {
		id: doc._id.toHexString(),
		category: doc.category,
		message: doc.message,
		name: doc.name ?? null,
		contact: doc.contact ?? null,
		contactKind: doc.contactKind ?? null,
		source: doc.source,
		userSub: doc.userSub ?? null,
		status: doc.status,
		createdAt: doc.createdAt.toISOString(),
		readAt: doc.readAt?.toISOString() ?? null,
		resolvedAt: doc.resolvedAt?.toISOString() ?? null,
	};
}

export const listContactMessages = defineOperation({
	id: "admin.listContactMessages",
	method: "GET",
	path: "/admin/contact-messages",
	summary: "List feedback and contact messages",
	description: `Messages from the "Góp ý / Liên hệ" form, newest first, optionally filtered by status (new, read, resolved) and category, one page at a time. ${OWNER_NOTE}`,
	input: z.object({
		status: z.enum(CONTACT_STATUSES).optional(),
		category: z.enum(CONTACT_CATEGORIES).optional(),
		page: z.number().int().min(1).max(10_000).default(1),
		pageSize: z.number().int().min(1).max(100).default(20),
	}),
	output: z.object({
		items: z.array(contactMessageItem),
		total: z.number().int(),
		page: z.number().int(),
		pageSize: z.number().int(),
	}),
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "admin",
	mcp: true,
	handler: async (_ctx, input) => {
		const query = {
			type: "contact" as const,
			...(input.status ? { status: input.status } : {}),
			...(input.category ? { category: input.category } : {}),
		};
		const [docs, total] = await Promise.all([
			ContactMessageModel.find(query)
				.sort({ createdAt: -1, _id: -1 })
				.skip((input.page - 1) * input.pageSize)
				.limit(input.pageSize)
				.lean<StoredContactMessage[]>(),
			ContactMessageModel.countDocuments(query),
		]);
		return {
			items: docs.map(toItem),
			total,
			page: input.page,
			pageSize: input.pageSize,
		};
	},
});

/**
 * Status change as a Mongo update. Dates of earlier steps are kept when a
 * message moves on (resolved keeps when it was read); `new` clears both.
 */
function statusUpdate(
	doc: StoredContactMessage,
	status: ContactStatus,
	now: Date,
): Record<string, unknown> {
	if (status === "new") {
		return { $set: { status }, $unset: { readAt: 1, resolvedAt: 1 } };
	}
	const readAt = doc.readAt ?? now;
	if (status === "read") {
		return { $set: { status, readAt }, $unset: { resolvedAt: 1 } };
	}
	return { $set: { status, readAt, resolvedAt: doc.resolvedAt ?? now } };
}

export const updateContactMessageStatus = defineOperation({
	id: "admin.updateContactMessageStatus",
	method: "PUT",
	path: "/admin/contact-messages/:messageId/status",
	summary: "Mark a contact message as new, read or resolved",
	description: `Sets the follow-up status of one message and returns it. ${OWNER_NOTE}`,
	input: z.object({ messageId, status: z.enum(CONTACT_STATUSES) }),
	output: contactMessageItem,
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "admin",
	mcp: true,
	handler: async (_ctx, input) => {
		const doc = await requireMessage(input.messageId);
		const updated = await ContactMessageModel.findOneAndUpdate(
			{ _id: doc._id, type: "contact" as const },
			statusUpdate(doc, input.status, new Date()),
			{ returnDocument: "after" },
		).lean<StoredContactMessage>();
		if (!updated) throw notFound();
		return toItem(updated);
	},
});

export const deleteContactMessage = defineOperation({
	id: "admin.deleteContactMessage",
	method: "DELETE",
	path: "/admin/contact-messages/:messageId",
	summary: "Delete a contact message",
	description: `Erases one message for good (text, name and reply address), e.g. spam or when the sender asks to be forgotten. Call with dryRun first. ${OWNER_NOTE}`,
	input: z.object({ messageId }),
	output: z.object({
		id: z.string(),
		deleted: z.boolean(),
		dryRun: z.boolean(),
	}),
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "admin",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const doc = await requireMessage(input.messageId);
		if (!ctx.dryRun) {
			await ContactMessageModel.deleteOne({ _id: doc._id, type: "contact" });
		}
		return {
			id: doc._id.toHexString(),
			deleted: !ctx.dryRun,
			dryRun: ctx.dryRun,
		};
	},
});

export const contactMessageAdminOperations = [
	listContactMessages,
	updateContactMessageStatus,
	deleteContactMessage,
] as const;
