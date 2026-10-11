import type { CollectionDetail } from "@localman/shared/api-client";
import { useI18n } from "../../i18n/i18n-context";
import { useWorkspaces } from "../workspaces/current-workspace";
import { subtreeIds } from "./tree-drop";

/** Requests of the collection, or of one folder and everything inside it. */
export function requestCount(
	detail: CollectionDetail,
	folderId: string | null,
): number {
	const inside = folderId ? subtreeIds(detail.nodes, folderId) : null;
	return detail.nodes.filter(
		(node) => node.kind === "request" && (!inside || inside.has(node.id)),
	).length;
}

export interface CollectionMetaProps {
	detail: CollectionDetail;
	folderId: string | null;
}

/** Who made it and changed it last, when, where, and how many requests. */
export function CollectionMeta({ detail, folderId }: CollectionMetaProps) {
	const { t, formatDate } = useI18n();
	const workspaces = useWorkspaces().data ?? [];
	const workspace = workspaces.find((w) => w.id === detail.workspaceId);
	const someone = t("collections.page.overview.member");
	return (
		<dl
			data-id="collection-meta"
			className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm"
		>
			<dt className="text-muted">{t("collections.page.overview.createdBy")}</dt>
			<dd className="m-0 truncate" data-id="collection-created-by">
				{detail.createdByName ?? someone}
			</dd>
			<dt className="text-muted">{t("collections.page.overview.updated")}</dt>
			<dd className="m-0" data-id="collection-updated">
				{t("collections.page.overview.updatedBy", {
					time: formatDate(detail.updatedAt),
					name: detail.updatedByName ?? someone,
				})}
			</dd>
			<dt className="text-muted">{t("collections.page.overview.workspace")}</dt>
			<dd className="m-0 truncate">{workspace?.name ?? "—"}</dd>
			<dt className="text-muted">{t("collections.page.overview.requests")}</dt>
			<dd className="m-0" data-id="collection-request-count">
				{requestCount(detail, folderId)}
			</dd>
		</dl>
	);
}
