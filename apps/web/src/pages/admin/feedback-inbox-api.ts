import {
	CONTACT_STATUSES,
	type ContactStatus,
} from "@localman/shared/constants";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

const BASE = "/api/v1/admin/contact-messages";
export const INBOX_PAGE_SIZE = 20;

export type MessageStatus = ContactStatus;

export interface ContactMessage {
	id: string;
	category: string;
	message: string;
	name: string | null;
	/** Email or Telegram `@username` to reply to. */
	contact: string | null;
	contactKind: "email" | "telegram" | null;
	source: string;
	/** Signed-in sender; null for a visitor. */
	userSub: string | null;
	status: MessageStatus;
	createdAt: string;
}

export interface ContactMessagePage {
	items: ContactMessage[];
	total: number;
}

export interface InboxFilter {
	/** "" for every status. */
	status: MessageStatus | "";
	/** "" for every category. */
	category: string;
}

export const EMPTY_INBOX_FILTER: InboxFilter = { status: "", category: "" };

export function isMessageStatus(value: string): value is MessageStatus {
	return CONTACT_STATUSES.some((status) => status === value);
}

function parseMessage(value: unknown): ContactMessage {
	const data: JsonRecord = expectRecord(value, "contact message");
	const status = expectString(data, "status");
	if (!isMessageStatus(status)) throw new InvalidResponseError("status");
	const kind = optionalString(data, "contactKind");
	if (kind !== null && kind !== "email" && kind !== "telegram") {
		throw new InvalidResponseError("contactKind");
	}
	return {
		id: expectString(data, "id"),
		category: expectString(data, "category"),
		message: expectString(data, "message"),
		name: optionalString(data, "name"),
		contact: optionalString(data, "contact"),
		contactKind: kind,
		source: expectString(data, "source"),
		userSub: optionalString(data, "userSub"),
		status,
		createdAt: expectString(data, "createdAt"),
	};
}

export async function fetchContactMessages(
	filter: InboxFilter,
	page: number,
): Promise<ContactMessagePage> {
	const params = new URLSearchParams({
		page: String(page),
		pageSize: String(INBOX_PAGE_SIZE),
	});
	if (filter.status) params.set("status", filter.status);
	if (filter.category) params.set("category", filter.category);
	const data = expectRecord(
		await apiRequest(`${BASE}?${params.toString()}`),
		"contact message page",
	);
	return {
		items: expectArray(data, "items").map(parseMessage),
		total: expectNumber(data, "total"),
	};
}

export async function setMessageStatus(
	id: string,
	status: MessageStatus,
): Promise<ContactMessage> {
	return parseMessage(
		await apiRequest(`${BASE}/${encodeURIComponent(id)}/status`, {
			method: "PUT",
			body: { status },
		}),
	);
}

/** Dry run first (`preview: true`) so a wrong id fails before the real delete. */
export async function deleteContactMessage(
	id: string,
	{ preview = false }: { preview?: boolean } = {},
): Promise<void> {
	const query = preview ? "?dryRun=true" : "";
	await apiRequest(`${BASE}/${encodeURIComponent(id)}${query}`, {
		method: "DELETE",
	});
}
