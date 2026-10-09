import { IconLink, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Badge } from "../../components/ui/badge";
import { IconButton } from "../../components/ui/icon-button";
import { useI18n, useT } from "../../i18n/i18n-context";
import {
	collaboratorLabel,
	personLabel,
	removeLabel,
	rowDataId,
} from "./collaborator-labels";
import type { Collaborator, MemberProfile } from "./collaborators-api";
import { PersonAvatar } from "./person-avatar";

const STATUS_TONE = {
	accepted: "success",
	pending: "warning",
	expired: "neutral",
} as const;

/**
 * Collapsing list item: grows in on mount (`@starting-style`) and folds
 * away while `leaving`, 200ms each (1ms with reduced motion).
 */
function AnimatedItem({
	dataId,
	itemId,
	leaving,
	onGone,
	children,
}: {
	dataId: string;
	itemId: string;
	leaving: boolean;
	onGone: () => void;
	children: ReactNode;
}) {
	return (
		<li
			data-id={dataId}
			data-collaborator-id={itemId}
			data-state={leaving ? "leaving" : "open"}
			onTransitionEnd={(event) => {
				if (leaving && event.target === event.currentTarget) onGone();
			}}
			className={
				"grid grid-rows-[1fr] transition-[grid-template-rows,opacity,translate] duration-(--dur-base) ease-decelerate motion-reduce:transition-none " +
				"starting:-translate-y-1 starting:grid-rows-[0fr] starting:opacity-0 " +
				"data-[state=leaving]:-translate-y-1 data-[state=leaving]:grid-rows-[0fr] data-[state=leaving]:opacity-0 data-[state=leaving]:ease-accelerate"
			}
		>
			<div className="min-h-0 overflow-hidden">
				<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md border border-border-subtle py-2 pr-2 pl-3 md:flex">
					{children}
				</div>
			</div>
		</li>
	);
}

function Label({ children }: { children: ReactNode }) {
	return (
		<span className="col-start-2 row-start-1 min-w-0 break-words font-mono text-[0.8125rem] md:flex-1 md:basis-40 md:truncate">
			{children}
		</span>
	);
}

function Badges({ children }: { children: ReactNode }) {
	return (
		<span className="col-start-2 row-start-2 flex flex-wrap gap-1">
			{children}
		</span>
	);
}

/** The owner: always first, never removable. */
export function OwnerRow({ owner }: { owner: MemberProfile }) {
	const t = useT();
	return (
		<AnimatedItem
			dataId="collaborator-owner"
			itemId="owner"
			leaving={false}
			onGone={() => {}}
		>
			<PersonAvatar
				name={owner.name || owner.username}
				picture={owner.picture}
			/>
			<Label>{personLabel(owner)}</Label>
			<Badges>
				<Badge tone="primary">{t("collaborators.row.owner")}</Badge>
			</Badges>
		</AnimatedItem>
	);
}

export interface CollaboratorRowProps {
	item: Collaborator;
	/** The row of the signed-in collaborator ("You"). */
	self: boolean;
	/** Owner view: the row has an X button. */
	canManage: boolean;
	leaving: boolean;
	/** Removal in flight: further clicks are ignored. */
	busy: boolean;
	onRemove: (item: Collaborator) => void;
	onGone: (id: string) => void;
}

export function CollaboratorRow({
	item,
	self,
	canManage,
	leaving,
	busy,
	onRemove,
	onGone,
}: CollaboratorRowProps) {
	const i18n = useI18n();
	const { t } = i18n;
	const locked = leaving || busy;
	const dataId = rowDataId(item);
	const user = item.user;
	return (
		<AnimatedItem
			dataId={dataId}
			itemId={item.id}
			leaving={leaving}
			onGone={() => onGone(item.id)}
		>
			{user ? (
				<PersonAvatar
					name={user.name || user.username}
					picture={user.picture}
				/>
			) : (
				<span
					aria-hidden="true"
					className="grid size-8 shrink-0 place-items-center rounded-sm bg-viz-grey text-on-tone"
				>
					<IconLink size={16} />
				</span>
			)}
			<Label>{collaboratorLabel(item, i18n)}</Label>
			<Badges>
				{user && !user.emailVerified && item.status !== "accepted" ? (
					<Badge tone="warning">{t("collaborators.row.emailUnverified")}</Badge>
				) : null}
				<Badge tone={STATUS_TONE[item.status]}>
					{t(`collaborators.row.status.${item.status}`)}
				</Badge>
				{self ? (
					<Badge tone="neutral">{t("collaborators.row.you")}</Badge>
				) : null}
			</Badges>
			{canManage ? (
				<IconButton
					size="sm"
					label={removeLabel(item, i18n)}
					data-id={`${dataId}-remove`}
					data-remove-button=""
					aria-disabled={locked || undefined}
					className="col-start-3 row-start-1"
					icon={<IconX size={16} aria-hidden="true" />}
					// Stays focusable while folding away; focus moves on once it is gone.
					onClick={() => !locked && onRemove(item)}
				/>
			) : null}
		</AnimatedItem>
	);
}
