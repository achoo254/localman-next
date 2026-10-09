import { z } from "zod";
import { runtimeSettings } from "../../config/runtime-settings.js";
import {
	CollaboratorModel,
	acceptedCountsPipeline,
} from "../collaborators/collaborator-model.js";
import { UserModel } from "../users/user-model.js";
import type { StoredProject } from "./project-model.js";

export const projectView = z.object({
	id: z.string(),
	name: z.string(),
	prefix: z.string(),
	secret: z.string(),
	/** Base URL of the project's mock API, prefix included. */
	mockBaseUrl: z.string(),
	role: z.enum(["owner", "collaborator"]),
	owner: z.object({
		sub: z.string(),
		username: z.string(),
		name: z.string().nullable(),
		picture: z.string().nullable(),
	}),
	/** Owner plus accepted collaborators (pending invitations excluded). */
	memberCount: z.number(),
	createdAt: z.string(),
});
export type ProjectView = z.input<typeof projectView>;

/** `localhost` and `*.localhost` have no certificate: plain http. */
function schemeOf(domain: string): "http" | "https" {
	const host = domain.replace(/:\d+$/, "");
	return host === "localhost" || host.endsWith(".localhost") ? "http" : "https";
}

/** `https://{secret}.{MOCK_BASE_DOMAIN}{prefix}`. */
export function mockBaseUrlOf(secret: string, prefix: string): string {
	const domain = runtimeSettings().mockBaseDomain;
	return `${schemeOf(domain)}://${secret}.${domain}${prefix}`;
}

interface OwnerProfile {
	sub: string;
	username: string;
	name?: string | null;
	picture?: string | null;
}

/** Accepted collaborators per project id (hex), in one query. */
async function acceptedCounts(
	projects: readonly StoredProject[],
): Promise<Map<string, number>> {
	const counts = await CollaboratorModel.aggregate<{
		_id: StoredProject["_id"];
		count: number;
	}>(acceptedCountsPipeline(projects.map((project) => project._id)));
	return new Map(counts.map((row) => [row._id.toHexString(), row.count]));
}

/** Views of projects as seen by `viewerSub`, owners loaded in one query. */
export async function toProjectViews(
	projects: readonly StoredProject[],
	viewerSub: string,
): Promise<ProjectView[]> {
	const subs = [...new Set(projects.map((project) => project.owner))];
	const [owners, members] = await Promise.all([
		UserModel.find({ sub: { $in: subs } })
			.select("sub username name picture")
			.lean<OwnerProfile[]>(),
		acceptedCounts(projects),
	]);
	const bySub = new Map(owners.map((owner) => [owner.sub, owner]));
	return projects.map((project) => {
		const owner = bySub.get(project.owner);
		return {
			id: project._id.toHexString(),
			name: project.name,
			prefix: project.prefix,
			secret: project.secret,
			mockBaseUrl: mockBaseUrlOf(project.secret, project.prefix),
			role: project.owner === viewerSub ? "owner" : "collaborator",
			owner: {
				sub: project.owner,
				// A user row always exists after sign-in; fall back defensively.
				username: owner?.username ?? project.owner,
				name: owner?.name ?? null,
				picture: owner?.picture ?? null,
			},
			memberCount: 1 + (members.get(project._id.toHexString()) ?? 0),
			createdAt: project.createdAt.toISOString(),
		};
	});
}

export async function toProjectView(
	project: StoredProject,
	viewerSub: string,
): Promise<ProjectView> {
	const [view] = await toProjectViews([project], viewerSub);
	if (!view) throw new Error("project view missing");
	return view;
}
