import type { CollectionSummary } from "@localman/shared/api-client";
import type { UseQueryResult } from "@tanstack/react-query";
import { Alert } from "../../components/ui/alert";
import { useT } from "../../i18n/i18n-context";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import type { Workspace } from "../workspaces/workspaces-api";
import { CollectionTree, type CollectionTreeProps } from "./collection-tree";
import { CollectionsEmpty, CollectionsSkeleton } from "./collections-empty";

export interface CollectionsBodyProps {
	workspacesQuery: UseQueryResult<Workspace[]>;
	list: UseQueryResult<CollectionSummary[]>;
	canAdd: boolean;
	creating: boolean;
	onNew: () => void;
	onImport: () => void;
	tree: CollectionTreeProps;
}

function RetryAlert({
	message,
	onRetry,
}: { message: string; onRetry: () => void }) {
	const t = useT();
	return (
		<Alert tone="danger" className="mx-3 my-2">
			{message}{" "}
			<button
				type="button"
				className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-primary underline"
				onClick={onRetry}
			>
				{t("common.cta.retry")}
			</button>
		</Alert>
	);
}

/** Loading, failure, empty, no match, or the tree itself. */
export function CollectionsBody(props: CollectionsBodyProps) {
	const t = useT();
	const { workspacesQuery, list } = props;
	const pending = workspacesQuery.isPending || list.isPending;
	const skeleton = useDelayedFlag(pending && !workspacesQuery.isError);
	if (skeleton) return <CollectionsSkeleton />;
	if (workspacesQuery.isError) {
		return (
			<RetryAlert
				message={t("workspaces.switcher.loadFailed")}
				onRetry={() => void workspacesQuery.refetch()}
			/>
		);
	}
	if (list.isError) {
		return (
			<RetryAlert
				message={t("collections.sidebar.loadFailed")}
				onRetry={() => void list.refetch()}
			/>
		);
	}
	if (pending) return null;
	if ((list.data ?? []).length === 0) {
		return (
			<CollectionsEmpty
				canAdd={props.canAdd}
				creating={props.creating}
				onNew={props.onNew}
				onImport={props.onImport}
			/>
		);
	}
	return <CollectionTree {...props.tree} />;
}
