import type { RefObject } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { CollaboratorRow, OwnerRow } from "./collaborator-row";
import type { Collaborator } from "./collaborators-api";
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

/** Loading, error and the owner-first list of the collaborators dialog. */
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
	const ready = state.status === "ready";
	return (
		<ul
			ref={listRef}
			aria-label={t("collaborators.list.label")}
			aria-busy={!ready || refreshing}
			className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-2 p-0"
		>
			{ready ? (
				<>
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
				</>
			) : (
				<li>
					<output
						data-id="modal-collaborators-loading"
						className="block font-mono text-muted text-sm"
					>
						{t("collaborators.list.loading")}
					</output>
				</li>
			)}
		</ul>
	);
}
