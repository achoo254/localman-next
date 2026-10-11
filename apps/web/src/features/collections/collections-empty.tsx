import { IconPlus, IconStack2, IconUpload } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";

export interface CollectionsEmptyProps {
	canAdd: boolean;
	creating: boolean;
	onNew: () => void;
	onImport: () => void;
}

/** A workspace without collections: what they are for, and how to start. */
export function CollectionsEmpty({
	canAdd,
	creating,
	onNew,
	onImport,
}: CollectionsEmptyProps) {
	const t = useT();
	return (
		<div
			data-id="sidebar-collections-empty"
			className="grid justify-items-center gap-3 px-4 py-8 text-center"
		>
			<span className="grid size-12 place-items-center rounded-lg border border-border border-dashed bg-surface text-icon-muted">
				<IconStack2 size={24} aria-hidden="true" />
			</span>
			<h3 className="m-0 font-bold font-mono text-sm">
				{t("collections.empty.title")}
			</h3>
			<p className="m-0 text-muted text-xs">{t("collections.empty.body")}</p>
			{canAdd ? (
				<div className="flex flex-wrap justify-center gap-2">
					<Button
						size="sm"
						variant="primary"
						data-id="sidebar-collections-empty-new"
						loading={creating}
						onClick={onNew}
					>
						<IconPlus size={16} aria-hidden="true" />
						{t("collections.empty.new")}
					</Button>
					<Button
						size="sm"
						variant="secondary"
						data-id="sidebar-collections-empty-import"
						onClick={onImport}
					>
						<IconUpload size={16} aria-hidden="true" />
						{t("collections.empty.import")}
					</Button>
				</div>
			) : (
				<p className="m-0 text-muted text-xs">
					{t("collections.sidebar.readOnly")}
				</p>
			)}
		</div>
	);
}

const ROWS = [0, 1, 2, 3, 4];

/** First load of the tree: collection rows at their real height. */
export function CollectionsSkeleton() {
	const t = useT();
	return (
		<SkeletonRegion
			data-id="sidebar-collections-loading"
			label={t("collections.sidebar.loading")}
			className="grid gap-px px-1 py-1"
		>
			{ROWS.map((row) => (
				<div
					key={row}
					className="flex min-h-7.5 items-center gap-1.5 pr-2 pl-1.5"
				>
					<Skeleton className="size-3.5" />
					<Skeleton className="size-4" />
					<Skeleton className="h-3 flex-1" />
				</div>
			))}
		</SkeletonRegion>
	);
}
