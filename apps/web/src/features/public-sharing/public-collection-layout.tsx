import {
	type ImportedItem,
	type ImportedRequest,
	type PublicCollectionView,
	countImportedRequests,
} from "@localman/shared/api-client";
import { type ReactNode, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { useI18n, useT } from "../../i18n/i18n-context";
import { PublicCollectionOverview } from "./public-collection-overview";
import { PublicRequestView } from "./public-request-view";
import { ReadOnlyTree } from "./read-only-tree";

function findRequest(
	items: readonly ImportedItem[],
	id: string,
): ImportedRequest | null {
	for (const item of items) {
		if (item.kind === "request") {
			if (item.id === id) return item;
		} else {
			const found = findRequest(item.items, id);
			if (found) return found;
		}
	}
	return null;
}

export interface PublicCollectionLayoutProps {
	view: PublicCollectionView;
	/** Badge next to the name: "read-only", "guest". */
	badge: string;
	/** Buttons or links of the page (request access, open in workspace). */
	actions?: ReactNode;
	/** A line under the header (what opening the link grants). */
	note?: ReactNode;
}

/**
 * A published collection, read-only: the name and meta, then the tree
 * of folders and requests beside the picked request (or the overview).
 * Shared by the public and the guest page.
 */
export function PublicCollectionLayout({
	view,
	badge,
	actions,
	note,
}: PublicCollectionLayoutProps) {
	const t = useT();
	const { formatDate } = useI18n();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const selected = selectedId ? findRequest(view.tree.items, selectedId) : null;
	const treeLabel = t("publicSharing.view.page.tree");
	return (
		<div className="grid gap-6 py-6 md:py-10" data-id="public-collection">
			<header className="grid gap-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="grid min-w-0 gap-1">
						<h1 className="m-0 flex flex-wrap items-center gap-2 break-words font-bold font-mono text-2xl">
							<span className="min-w-0 break-words">{view.name}</span>
							<Badge tone="neutral">{badge}</Badge>
						</h1>
						<p className="m-0 text-muted text-sm">
							{t("publicSharing.view.page.requests", {
								count: countImportedRequests(view.tree.items),
							})}
							{" · "}
							{t("publicSharing.view.page.updated", {
								date: formatDate(view.updatedAt),
							})}
						</p>
					</div>
					{actions ? (
						<div className="flex flex-wrap gap-2">{actions}</div>
					) : null}
				</div>
				{note}
			</header>
			<div className="grid gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
				<nav aria-label={treeLabel} className="min-w-0">
					<Card className="p-2">
						{view.tree.items.length > 0 ? (
							<ReadOnlyTree
								items={view.tree.items}
								label={treeLabel}
								selectedId={selectedId}
								onSelect={(request) => setSelectedId(request.id)}
							/>
						) : (
							<p className="m-0 p-2 text-muted text-sm">
								{t("publicSharing.view.page.emptyTree")}
							</p>
						)}
					</Card>
				</nav>
				<Card className="min-w-0 p-6 max-sm:p-4">
					{selected ? (
						<PublicRequestView key={selected.id} request={selected} />
					) : (
						<PublicCollectionOverview
							description={view.description}
							tree={view.tree}
						/>
					)}
				</Card>
			</div>
		</div>
	);
}
