import { IconUpload } from "@tabler/icons-react";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { CollectionNewMenu } from "./collection-new-menu";
import type { CollectionCreator } from "./use-collection-create";

export interface CollectionsHeadProps {
	titleId: string;
	creator: CollectionCreator;
	/** Admins and Editors of the workspace add collections. */
	canAdd: boolean;
	onImport: () => void;
}

/** Title of the Collections panel with its "+" menu and Import. */
export function CollectionsHead({
	titleId,
	creator,
	canAdd,
	onImport,
}: CollectionsHeadProps) {
	const t = useT();
	const readOnly = t("collections.sidebar.readOnly");
	return (
		<header className="flex items-center gap-1 border-border-subtle border-b py-2 pr-2 pl-3">
			<h2
				id={titleId}
				className="m-0 min-w-0 flex-1 truncate font-bold font-mono text-sm"
			>
				{t("collections.sidebar.title")}
			</h2>
			<CollectionNewMenu
				creator={creator}
				disabled={!canAdd}
				disabledReason={readOnly}
			/>
			<IconButton
				size="sm"
				data-id="sidebar-collections-import"
				label={t("collections.sidebar.import")}
				title={canAdd ? t("collections.sidebar.import") : readOnly}
				disabled={!canAdd}
				icon={<IconUpload size={18} aria-hidden="true" />}
				onClick={onImport}
			/>
		</header>
	);
}
