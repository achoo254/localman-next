import { IconLink, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Badge } from "../../components/ui/badge";
import { IconButton } from "../../components/ui/icon-button";
import { formatDate } from "../../lib/format";
import type { Collaborator, MemberProfile } from "./collaborators-api";
import { PersonAvatar } from "./person-avatar";

/** `Minh Anh · @minhanh`, or `@minhanh` without a display name. */
export function personLabel(person: {
	name: string | null;
	username: string;
}): string {
	return person.name
		? `${person.name} · @${person.username}`
		: `@${person.username}`;
}

export function collaboratorLabel(item: Collaborator): string {
	const date = item.expiresAt ? formatDate(item.expiresAt) : "";
	const expired = item.status === "expired";
	if (item.user) {
		const base = personLabel(item.user);
		return expired ? `${base} · đã hết hạn ${date}` : base;
	}
	const email = item.inviteeEmail ?? "email đã ẩn";
	return `Link mời · ${email} · ${expired ? "đã hết hạn" : "hết hạn"} ${date}`;
}

/** Accessible name of the X button: what pressing it does, and to whom. */
export function removeLabel(item: Collaborator): string {
	const label = collaboratorLabel(item);
	if (item.status === "accepted") return `Xoá ${label} khỏi project`;
	if (item.status === "pending") return `Huỷ lời mời ${label}`;
	return `Xoá lời mời ${label}`;
}

export function rowDataId(item: Collaborator): string {
	return item.user
		? `collaborator-${item.user.username}`
		: `collaborator-link-${item.id}`;
}

const STATUS_BADGE = {
	accepted: <Badge tone="success">Đã tham gia</Badge>,
	pending: <Badge tone="warning">Đang chờ</Badge>,
	expired: <Badge tone="neutral">Hết hạn</Badge>,
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
				<Badge tone="primary">Owner</Badge>
			</Badges>
		</AnimatedItem>
	);
}

export interface CollaboratorRowProps {
	item: Collaborator;
	/** The row of the signed-in collaborator ("Bạn"). */
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
			<Label>{collaboratorLabel(item)}</Label>
			<Badges>
				{user && !user.emailVerified && item.status !== "accepted" ? (
					<Badge tone="warning">email chưa xác minh</Badge>
				) : null}
				{STATUS_BADGE[item.status]}
				{self ? <Badge tone="neutral">Bạn</Badge> : null}
			</Badges>
			{canManage ? (
				<IconButton
					size="sm"
					label={removeLabel(item)}
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
