import { requestContext } from "@localman/shared/api-client";
import { IconChevronRight } from "@tabler/icons-react";
import { Fragment } from "react";
import { useT } from "../../i18n/i18n-context";
import { tabLabel } from "../api-client/tabs/tab-label";
import type { WorkbenchTab } from "../api-client/workbench/workbench-types";
import type { OpenNode } from "./open-node";
import { useCollection } from "./use-collections";

const SEGMENT =
	"min-w-0 max-w-48 cursor-pointer truncate rounded-xs border-0 bg-transparent p-0 text-muted text-xs underline-offset-2 hover:text-fg hover:underline focus-visible:shadow-focus-primary focus-visible:outline-none";

export interface RequestBreadcrumbProps {
	tab: WorkbenchTab;
	onOpen: OpenNode;
}

/** "Collection / Folder / Request" above a bound request; parents open their tabs. */
export function RequestBreadcrumb({ tab, onOpen }: RequestBreadcrumbProps) {
	const t = useT();
	const source = tab.source;
	const collection = useCollection(source?.collectionId ?? "", source !== null);
	const detail = collection.data;
	const context =
		detail && source ? requestContext(detail, source.nodeId) : null;
	if (!detail || !context) return null;
	const separator = (
		<IconChevronRight
			size={12}
			aria-hidden="true"
			className="flex-none text-icon-muted"
		/>
	);
	return (
		<nav
			aria-label={t("collections.breadcrumb.label")}
			data-id="request-breadcrumb"
			className="px-4 pt-3"
		>
			<ol className="m-0 flex min-w-0 list-none flex-wrap items-center gap-1 p-0">
				<li className="flex min-w-0 items-center gap-1">
					<button
						type="button"
						className={SEGMENT}
						onClick={() =>
							onOpen({
								kind: "collection",
								collectionId: detail.id,
								name: detail.name,
							})
						}
					>
						{detail.name}
					</button>
				</li>
				{context.folderPath.map((folder) => (
					<Fragment key={folder.id}>
						<li aria-hidden="true">{separator}</li>
						<li className="flex min-w-0 items-center">
							<button
								type="button"
								className={SEGMENT}
								onClick={() =>
									onOpen({
										kind: "folder",
										collectionId: detail.id,
										nodeId: folder.id,
										name: folder.name,
									})
								}
							>
								{folder.name}
							</button>
						</li>
					</Fragment>
				))}
				<li aria-hidden="true">{separator}</li>
				<li aria-current="page" className="min-w-0 truncate text-fg text-xs">
					{tabLabel(tab.draft) || t("apiClient.request.untitled")}
				</li>
			</ol>
		</nav>
	);
}
