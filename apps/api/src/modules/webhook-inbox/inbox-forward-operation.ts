import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import { InboxModel, type StoredInbox } from "./inbox-model.js";
import { inboxForwardSchema, inboxNameSchema } from "./inbox-schema.js";
import { inboxNotFound, requestCounts } from "./inbox-store.js";
import { inboxView, toInboxView } from "./inbox-view.js";

const FORWARD_EXEMPT =
	"đổi nơi inbox chuyển tiếp webhook (kèm header và body của bên gửi) tới tunnel khác; agent bị prompt injection không được chuyển dữ liệu đi chỗ khác, nên chỉ user đổi từ giao diện";

export const setWebhookInboxForward = defineOperation({
	id: "traffic.setWebhookInboxForward",
	method: "PUT",
	path: "/projects/:projectId/inboxes/:name/forward",
	summary: "Set or turn off where a webhook inbox forwards requests",
	description:
		"Owner only (collaborators get 403). forward { port, path } sends a copy of every inbox request (method, query, the sender's headers and body) to the URL the owner mapped to localhost:<port> in the API client settings, followed by path; null turns forwarding off. Sent in the background after the sender got its answer, retried up to 3 times (1 s, then 4 s apart) on a network error, a 30-second timeout, a missing tunnel or a 5xx; the attempts go onto the request's log line and the inbox's lastForward.",
	input: z.object({
		projectId: z.string().min(1).max(64),
		name: inboxNameSchema,
		forward: inboxForwardSchema.nullable(),
	}),
	output: inboxView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "traffic",
	mcp: { exempt: FORWARD_EXEMPT },
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "update", input.projectId);
		const inbox = await InboxModel.findOneAndUpdate(
			{ projectId: project._id, name: input.name },
			{ $set: { forward: input.forward } },
			{ returnDocument: "after" },
		).lean<StoredInbox>();
		if (!inbox) throw inboxNotFound();
		const counts = await requestCounts(project._id);
		return toInboxView(inbox, project.secret, counts.get(inbox.name) ?? 0);
	},
});
