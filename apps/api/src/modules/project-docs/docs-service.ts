import { OperationError } from "@localman/operations";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import {
	LIVE_PROJECT,
	ProjectModel,
	type StoredProject,
} from "../projects/project-model.js";
import { requireProject } from "../projects/project-service.js";
import {
	isCapabilityId,
	newCapabilityId,
} from "../public-sharing/capability-id.js";
import { loadResources, toTreeNodes } from "../resources/resource-store.js";
import { orderTree } from "../resources/resource-tree.js";
import {
	DOCS_SLUG_BYTES,
	DocsLinkModel,
	type StoredDocsLink,
} from "./docs-link-model.js";
import { type ProjectDocs, renderProjectDocs } from "./docs-render.js";

export interface DocsSettings {
	readonly published: boolean;
	/** `null` while unpublished. */
	readonly url: string | null;
}

/** `{PUBLIC_URL}/p/{slug}/docs`: the page anyone with the link opens. */
const docsUrlOf = (slug: string): string =>
	new URL(`/p/${encodeURIComponent(slug)}/docs`, tenantSettings().publicUrl)
		.href;

function settingsOf(link: StoredDocsLink | null): DocsSettings {
	return link
		? { published: true, url: docsUrlOf(link.slug) }
		: { published: false, url: null };
}

/** Whether the project's docs are published (any member). */
export async function docsSettings(
	sub: string,
	projectId: string,
): Promise<DocsSettings> {
	const project = await requireProject(sub, "read", projectId);
	return settingsOf(
		await DocsLinkModel.findOne({
			projectId: project._id,
		}).lean<StoredDocsLink>(),
	);
}

/**
 * Publishes the docs (a new unguessable link) or takes them down (the
 * link stops working), for Editors of the project. Publishing twice
 * keeps the link.
 */
export async function setDocsPublished(
	sub: string,
	projectId: string,
	published: boolean,
): Promise<DocsSettings> {
	const project = await requireProject(sub, "editResources", projectId);
	if (!published) {
		await DocsLinkModel.deleteOne({ projectId: project._id });
		return settingsOf(null);
	}
	const link = await DocsLinkModel.findOneAndUpdate(
		{ projectId: project._id },
		{
			$setOnInsert: {
				projectId: project._id,
				slug: newCapabilityId(DOCS_SLUG_BYTES),
				createdBy: sub,
			},
		},
		{ upsert: true, returnDocument: "after" },
	).lean<StoredDocsLink>();
	return settingsOf(link);
}

function docsNotFound(): OperationError {
	return new OperationError(404, "DOCS_NOT_FOUND", "These docs do not exist");
}

/** The published docs of the link's project, as they are now. */
export async function publicDocs(slug: string): Promise<ProjectDocs> {
	if (!isCapabilityId(slug, DOCS_SLUG_BYTES)) throw docsNotFound();
	const link = await DocsLinkModel.findOne({ slug }).lean<StoredDocsLink>();
	if (!link) throw docsNotFound();
	const project = await ProjectModel.findOne({
		_id: link.projectId,
		...LIVE_PROJECT,
	}).lean<StoredProject>();
	if (!project) throw docsNotFound();
	const stored = await loadResources(project._id);
	const byId = new Map(stored.map((r) => [r._id.toHexString(), r]));
	const resources = orderTree(toTreeNodes(stored)).flatMap(({ node }) => {
		const resource = byId.get(node.id);
		return resource
			? [
					{
						id: node.id,
						name: resource.name,
						parentId: node.parentId,
						parentKey: resource.parentKey ?? null,
						schema: resource.schema,
						endpoints: resource.endpoints,
					},
				]
			: [];
	});
	return renderProjectDocs(project.name, resources);
}
