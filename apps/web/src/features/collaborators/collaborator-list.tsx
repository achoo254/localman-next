import type { RefObject } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { PanelProgress } from "../../components/ui/panel-progress";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { CollaboratorRow, OwnerRow } from "./collaborator-row";
import type { Collaborator } from "./collaborators-api";
import { CollaboratorsSkeleton } from "./collaborators-skeleton";
import type { CollaboratorsState } from "./use-collaborators";

export interface CollaboratorListProps {
	state: CollaboratorsState;
	leaving: ReadonlySet<string>;
	/** Rows whose removal is in flight: their X button is disabled. */
	removing: ReadonlySet<string>;
	/** A background refresh is running; the rows stay on screen. */
	refreshing: boolean;
	viewerSub: string | null;
	listRef: RefObject<HTMLUListElement | null>;
	onRetry: () => void;
	onRemove: (item: Collaborator) => void;
	onGone: (id: string) => void;
}

/**
 * Loading, error and the owner-first list of the collaborators dialog. A
 * background refresh keeps the rows and runs a bar along their top.
 */
export function CollaboratorList({
	state,
	leaving,
	removing,
	refreshing,
	viewerSub,
	listRef,
	onRetry,
	onRemove,
	onGone,
}: CollaboratorListProps) {
	const t = useT();
	const skeleton = useDelayedFlag(state.status === "loading");
	if (skeleton) return <CollaboratorsSkeleton />;
	if (state.status === "loading") return null;
	if (state.status === "error") {
		return (
			<div className="grid justify-items-start gap-3">
				<Alert
					tone="danger"
					title={t("collaborators.list.loadFailed")}
					data-id="modal-collaborators-error"
				>
					{errorMessage(state.error)}
				</Alert>
				<Button data-id="modal-collaborators-retry" onClick={onRetry}>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	}
	return (
		<PanelProgress data-id="modal-collaborators-panel" active={refreshing}>
			<ul
				ref={listRef}
				aria-label={t("collaborators.list.label")}
				aria-busy={refreshing}
				className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-2 p-0"
			>
				<OwnerRow owner={state.list.owner} />
				{state.list.items.map((item) => (
					<CollaboratorRow
						key={item.id}
						item={item}
						self={item.user !== null && item.user.sub === viewerSub}
						canManage={state.list.canManage}
						leaving={leaving.has(item.id)}
						busy={removing.has(item.id)}
						onRemove={onRemove}
						onGone={onGone}
					/>
				))}
			</ul>
		</PanelProgress>
	);
}
