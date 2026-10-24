import { type AnyOperation, defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { takeIpSlot } from "../public-sharing/public-sharing-limits.js";
import { projectIdParam } from "../resources/resource-operation-params.js";
import { docsSettings, publicDocs, setDocsPublished } from "./docs-service.js";
import "./docs-project-dependent.js";

const settingsView = z.object({
	published: z.boolean(),
	url: z.string().nullable(),
});

const docsView = z.object({
	name: z.string(),
	version: z.string(),
	resources: z.array(
		z.object({
			name: z.string(),
			depth: z.number().int().min(0),
			fields: z.array(
				z.object({
					name: z.string(),
					type: z.string(),
					detail: z.string().nullable(),
				}),
			),
			endpoints: z.array(z.object({ method: z.string(), path: z.string() })),
			example: z.record(z.string(), z.unknown()),
		}),
	),
});

const ABOUT =
	"Public docs of a mock project: its resources, fields, the endpoints it serves and an example record, always as the project is now. Off until an Editor publishes them; the link is unguessable and stops working when they are taken down. The mock's URL is never in them (it carries the project secret): paths sit on {baseUrl}.";

export const projectDocsOperations: readonly AnyOperation[] = [
	defineOperation({
		id: "mock-advanced.getProjectDocs",
		method: "GET",
		path: "/projects/:projectId/docs",
		summary: "Get whether a mock project's public docs are published",
		description: `${ABOUT} Members of the project.`,
		input: z.object({ projectId: projectIdParam }),
		output: settingsView,
		scopes: [USER_SCOPE],
		annotations: { readOnly: true, destructive: false, idempotent: true },
		toolset: "mock-advanced",
		mcp: true,
		handler: async (ctx, input) =>
			docsSettings(requireSubject(ctx), input.projectId),
	}),
	defineOperation({
		id: "mock-advanced.setProjectDocs",
		method: "PUT",
		path: "/projects/:projectId/docs",
		summary: "Publish or take down a mock project's public docs",
		description: `${ABOUT} Editors of the project. \`published: true\` keeps an existing link; \`false\` makes it stop working, and publishing again gives a new one.`,
		input: z.object({ projectId: projectIdParam, published: z.boolean() }),
		output: settingsView,
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: true },
		toolset: "mock-advanced",
		mcp: true,
		handler: async (ctx, input) =>
			setDocsPublished(requireSubject(ctx), input.projectId, input.published),
	}),
	defineOperation({
		id: "public.getProjectDocs",
		method: "GET",
		path: "/public/docs/:slug",
		summary: "Read the published docs of a mock project",
		description: `Public, no sign-in. ${ABOUT} \`version\` changes exactly when the docs do. 404 DOCS_NOT_FOUND for an unknown or taken-down link or a deleted project; 429 RATE_LIMITED per client address.`,
		input: z.object({ slug: z.string().min(1).max(64) }),
		output: docsView,
		scopes: [],
		annotations: { readOnly: true, destructive: false, idempotent: true },
		toolset: "public",
		mcp: {
			exempt:
				"Trang công khai cho người mở link trên trình duyệt; agent đọc cấu trúc project của mình qua mock.getMockUrls và list_resources",
		},
		handler: async (ctx, { slug }) => {
			// Counted before any lookup, so guessing slugs costs the guesser.
			await takeIpSlot("publicLink", ctx.clientIp);
			return publicDocs(slug);
		},
	}),
];
