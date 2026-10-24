import { type AnyOperation, defineOperation } from "@localman/operations";
import {
	MAX_PROXY_ENVELOPE_BYTES,
	type PreparedRequest,
	SNIPPET_TARGETS,
	type SnippetTarget,
	generateSnippet,
	proxyRequestSchema,
	snippetSyntax,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";

type ProxyRequest = z.infer<typeof proxyRequestSchema>;

/** The send_request envelope as the generators' prepared request. */
function preparedOf(request: ProxyRequest): PreparedRequest {
	const { method, url, headers, body, bodyType } = request;
	return {
		method,
		url,
		headers,
		body:
			bodyType === "text"
				? { kind: "text", text: body ?? "" }
				: bodyType === "base64"
					? { kind: "bytes", bytes: Buffer.from(body ?? "", "base64") }
					: { kind: "none" },
		secretsUsed: [],
		unresolved: [],
	};
}

export const generateCodeSnippet = defineOperation({
	id: "client.generateCodeSnippet",
	method: "POST",
	path: "/client/code-snippets",
	summary: "Turn a request into code for a language or tool",
	description: `Code that sends \`request\` (the same envelope as send_request: method, url, headers, body, bodyType; options are ignored) in \`target\`: ${SNIPPET_TARGETS.join(", ")}. Like the Code button of the API client, but nothing is resolved: put values in yourself, {{variables}} stay as written. \`syntax\` names the language for highlighting; \`bodyOmitted\` is true when a base64 body is not UTF-8 text and the code leaves it out. Nothing is stored and no request is sent.`,
	input: z.object({
		target: z.enum(SNIPPET_TARGETS),
		// Nothing is filled here, so `variables` (and a template URL) is refused.
		request: proxyRequestSchema.refine(
			(request) => request.variables === undefined,
			{ path: ["variables"], message: "variables are not filled in snippets" },
		),
	}),
	output: z.object({
		code: z.string(),
		syntax: z.string(),
		bodyOmitted: z.boolean(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	bodyLimit: MAX_PROXY_ENVELOPE_BYTES,
	handler: async (ctx, input) => {
		requireSubject(ctx);
		const target: SnippetTarget = input.target;
		const { code, bodyOmitted } = generateSnippet(
			target,
			preparedOf(input.request),
		);
		return { code, syntax: snippetSyntax(target), bodyOmitted };
	},
});

export const codeSnippetOperations: readonly AnyOperation[] = [
	generateCodeSnippet,
];
