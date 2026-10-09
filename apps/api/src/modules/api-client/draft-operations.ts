import { defineOperation } from "@localman/operations";
import {
	DRAFT_MAX_TABS,
	apiRequestDraftSchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	deleteDraft as deleteTabDraft,
	listDrafts as listTabDrafts,
	reorderDrafts as reorderTabDrafts,
	saveDraft as saveTabDraft,
} from "./draft-service.js";
import { DRAFT_BODY_LIMIT, DRAFT_MAX_BYTES } from "./draft-size.js";

const TAB_STATE = "tab state of the API client page in the browser";

/** Chosen by the browser (e.g. a UUID). */
const tabId = z
	.string()
	.regex(/^[A-Za-z0-9_-]{1,64}$/, "must be 1-64 letters, digits, - or _");
const order = z.number().int().min(0).max(10_000);

const draftView = z.object({
	tabId: z.string(),
	order: z.number().int(),
	draft: apiRequestDraftSchema,
	updatedAt: z.string(),
});
const draftList = z.object({ items: z.array(draftView) });

export const listDrafts = defineOperation({
	id: "client.listDrafts",
	method: "GET",
	path: "/client/drafts",
	summary: "List the open API client tabs with their unsaved requests",
	description: "Own tabs only, in tab-bar order.",
	input: z.object({}),
	output: draftList,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: { exempt: TAB_STATE },
	handler: async (ctx) => ({ items: await listTabDrafts(requireSubject(ctx)) }),
});

export const saveDraft = defineOperation({
	id: "client.saveDraft",
	method: "PUT",
	path: "/client/drafts/:tabId",
	summary: "Save the unsaved request of one API client tab",
	description: `Creates or replaces the tab's draft, {{var}} placeholders kept. At most ${DRAFT_MAX_BYTES} bytes of JSON (413 DRAFT_TOO_LARGE) and ${DRAFT_MAX_TABS} tabs (409 DRAFT_LIMIT_REACHED). A new tab without \`order\` goes last.`,
	input: z.object({
		tabId,
		draft: apiRequestDraftSchema,
		order: order.optional(),
	}),
	output: draftView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: { exempt: TAB_STATE },
	bodyLimit: DRAFT_BODY_LIMIT,
	handler: async (ctx, input) => saveTabDraft(requireSubject(ctx), input),
});

export const reorderDrafts = defineOperation({
	id: "client.reorderDrafts",
	method: "PUT",
	path: "/client/draft-order",
	summary: "Set the order of the API client tabs",
	description:
		"Each listed tab takes its index as position; tabs not listed keep theirs.",
	input: z.object({ tabIds: z.array(tabId).max(DRAFT_MAX_TABS) }),
	output: draftList,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: { exempt: TAB_STATE },
	handler: async (ctx, input) => ({
		items: await reorderTabDrafts(requireSubject(ctx), input.tabIds),
	}),
});

export const deleteDraft = defineOperation({
	id: "client.deleteDraft",
	method: "DELETE",
	path: "/client/drafts/:tabId",
	summary: "Drop the unsaved request of a closed API client tab",
	description: "`deleted` is false when the tab had no saved draft.",
	input: z.object({ tabId }),
	output: z.object({ tabId: z.string(), deleted: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: { exempt: TAB_STATE },
	handler: async (ctx, input) => ({
		tabId: input.tabId,
		deleted: await deleteTabDraft(requireSubject(ctx), input.tabId),
	}),
});

export const draftOperations = [
	listDrafts,
	saveDraft,
	reorderDrafts,
	deleteDraft,
] as const;
