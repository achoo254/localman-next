import { type AnyOperation, defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import { setWebhookInboxForward } from "./inbox-forward-operation.js";
import { InboxModel, type StoredInbox } from "./inbox-model.js";
import { inboxNameSchema, inboxResponseSchema } from "./inbox-schema.js";
import {
	createInbox,
	inboxLimitOf,
	inboxNotFound,
	listInboxes,
	requestCounts,
	requireInbox,
} from "./inbox-store.js";
import { inboxView, toInboxView } from "./inbox-view.js";

const projectId = z.string().min(1).max(64);
const OWNER_ONLY = "Owner only (collaborators get 403).";

export const listWebhookInboxes = defineOperation({
	id: "traffic.listWebhookInboxes",
	method: "GET",
	path: "/projects/:projectId/inboxes",
	summary: "List a mock project's webhook inboxes",
	description:
		"Public URLs ({mock base}/_inbox/<name>) that accept any method, answer with the inbox's response and log the request with source inbox. Each item has the response, forward (tunnel:<port><path> or null), lastForward (attempts of the latest forward) and requestCount (its requests still in the request log); used/max is the count against the owner plan's webhook inboxes per project; canManage says whether the caller may change them (owner only). Members of the project only.",
	input: z.object({ projectId }),
	output: z.object({
		items: z.array(inboxView),
		used: z.number(),
		max: z.number(),
		canManage: z.boolean(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "traffic",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "read", input.projectId);
		const inboxes = await listInboxes(project._id);
		const counts = await requestCounts(project._id);
		return {
			items: inboxes.map((inbox) =>
				toInboxView(inbox, project.secret, counts.get(inbox.name) ?? 0),
			),
			used: inboxes.length,
			max: await inboxLimitOf(project.owner),
			canManage: project.owner === sub,
		};
	},
});

export const createWebhookInbox = defineOperation({
	id: "traffic.createWebhookInbox",
	method: "POST",
	path: "/projects/:projectId/inboxes",
	summary: "Create a webhook inbox in a mock project",
	description: `${OWNER_ONLY} name: lowercase letters, digits and -, up to 32, unique in the project (409 INBOX_NAME_TAKEN). response (optional): status 200-599 (default 200), contentType (application/json or text/plain, JSON variants such as application/problem+json and a charset allowed; default application/json) and body up to 64 KB (default {"received":true}). Past the owner plan's inboxes per project: 403 PLAN_LIMIT_REACHED with details { limit: "webhookInboxes", max, used }. Forwarding to a tunnel is set from the Localman UI only.`,
	input: z.object({
		projectId,
		name: inboxNameSchema,
		response: inboxResponseSchema.optional(),
	}),
	output: inboxView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "traffic",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "update", input.projectId);
		const response = input.response ?? inboxResponseSchema.parse({});
		const inbox = await createInbox(
			project._id,
			project.owner,
			input.name,
			response,
		);
		return toInboxView(inbox, project.secret, 0);
	},
});

export const updateWebhookInbox = defineOperation({
	id: "traffic.updateWebhookInbox",
	method: "PUT",
	path: "/projects/:projectId/inboxes/:name",
	summary: "Change the response of a webhook inbox",
	description: `${OWNER_ONLY} Replaces what the inbox answers: status 200-599, contentType (application/json or text/plain, as on create) and body up to 64 KB (each defaults as on create). Applies to the next request.`,
	input: z.object({
		projectId,
		name: inboxNameSchema,
		response: inboxResponseSchema,
	}),
	output: inboxView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "traffic",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "update", input.projectId);
		const inbox = await InboxModel.findOneAndUpdate(
			{ projectId: project._id, name: input.name },
			{ $set: { response: input.response } },
			{ returnDocument: "after" },
		).lean<StoredInbox>();
		if (!inbox) throw inboxNotFound();
		const counts = await requestCounts(project._id);
		return toInboxView(inbox, project.secret, counts.get(inbox.name) ?? 0);
	},
});

export const deleteWebhookInbox = defineOperation({
	id: "traffic.deleteWebhookInbox",
	method: "DELETE",
	path: "/projects/:projectId/inboxes/:name",
	summary: "Delete a webhook inbox",
	description: `${OWNER_ONLY} The URL stops accepting requests at once (senders get 404); requests already logged stay in the request log until they expire. Call with dryRun to check the inbox exists without deleting it.`,
	input: z.object({ projectId, name: inboxNameSchema }),
	output: z.object({ dryRun: z.boolean(), name: z.string() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "traffic",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "update", input.projectId);
		const inbox = await requireInbox(project._id, input.name);
		if (!ctx.dryRun) await InboxModel.deleteOne({ _id: inbox._id });
		return { dryRun: ctx.dryRun, name: inbox.name };
	},
});

/** Webhook inbox operations of the `traffic` toolset. */
export const webhookInboxOperations: AnyOperation[] = [
	listWebhookInboxes,
	createWebhookInbox,
	updateWebhookInbox,
	setWebhookInboxForward,
	deleteWebhookInbox,
];
