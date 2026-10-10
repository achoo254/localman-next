import { IconTrash } from "@tabler/icons-react";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { FEEDBACK_CATEGORIES } from "../../features/feedback/feedback-draft";
import { useI18n } from "../../i18n/i18n-context";
import type { Messages } from "../../i18n/message-types";
import type { Translate } from "../../i18n/translate";
import type { ContactMessage, MessageStatus } from "./feedback-inbox-api";

export const STATUS_TONES: Readonly<Record<MessageStatus, BadgeTone>> = {
	new: "accent",
	read: "info",
	resolved: "success",
};

/** Name of a status, in the current language. */
export function statusLabel(t: Translate, status: MessageStatus): string {
	return t(`admin.inbox.statuses.${status}`);
}

/** Key of each known source under `admin.inbox.sources`. */
const SOURCE_KEYS: Readonly<
	Record<string, keyof Messages["admin"]["inbox"]["sources"]>
> = {
	landing: "landing",
	projects: "projects",
	account: "account",
	admin: "admin",
	invite: "invite",
	docs: "docs",
	other: "elsewhere",
};

type ActionKey = keyof Messages["admin"]["inbox"]["actions"];

/** Next steps offered for each status. */
const ACTIONS: Readonly<
	Record<MessageStatus, readonly { to: MessageStatus; key: ActionKey }[]>
> = {
	new: [
		{ to: "read", key: "markRead" },
		{ to: "resolved", key: "markResolved" },
	],
	read: [
		{ to: "resolved", key: "markResolved" },
		{ to: "new", key: "markUnread" },
	],
	resolved: [{ to: "new", key: "reopen" }],
};

export function categoryLabel(t: Translate, id: string): string {
	const choice = FEEDBACK_CATEGORIES.find((item) => item.id === id);
	return choice ? t(`feedback.categories.${choice.key}.label`) : id;
}

/** Who sent it: the name left, else whether it came from an account. */
export function senderLabel(t: Translate, item: ContactMessage): string {
	return (
		item.name ??
		(item.userSub ? t("admin.inbox.user") : t("admin.inbox.visitor"))
	);
}

export interface FeedbackInboxItemProps {
	item: ContactMessage;
	/** Status this message is being moved to; that button spins meanwhile. */
	pendingStatus: MessageStatus | null;
	onStatus: (item: ContactMessage, status: MessageStatus) => void;
	onDelete: (item: ContactMessage) => void;
}

/** One message: who, where from, the full text, and follow-up actions. */
export function FeedbackInboxItem({
	item,
	pendingStatus,
	onStatus,
	onDelete,
}: FeedbackInboxItemProps) {
	const { t, formatDate } = useI18n();
	const itemId = `admin-feedback-item-${item.id}`;
	const headingId = `${itemId}-heading`;
	const sender = senderLabel(t, item);
	const sourceKey = SOURCE_KEYS[item.source];
	const pending = pendingStatus !== null;
	return (
		<li
			data-id={itemId}
			className="grid gap-3 border-border-subtle border-b px-5 py-4 last:border-b-0"
		>
			<div className="flex flex-wrap items-center gap-2">
				<h2 id={headingId} className="m-0 font-mono font-semibold text-sm">
					{categoryLabel(t, item.category)} · {sender}
				</h2>
				<Badge tone={STATUS_TONES[item.status]} data-id={`${itemId}-status`}>
					{statusLabel(t, item.status)}
				</Badge>
				{item.userSub ? <Badge>{t("admin.inbox.signedIn")}</Badge> : null}
				<span className="ml-auto font-mono text-[0.8125rem] text-muted">
					{formatDate(item.createdAt)} ·{" "}
					{sourceKey ? t(`admin.inbox.sources.${sourceKey}`) : item.source}
				</span>
			</div>
			<p className="m-0 whitespace-pre-wrap break-words text-fg text-sm">
				{item.message}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-mono text-[0.8125rem] text-muted">
					{item.contact
						? `${item.contactKind === "telegram" ? "Telegram" : "Email"}: ${item.contact}`
						: t("admin.inbox.noContact")}
				</span>
				<span className="ml-auto flex flex-wrap gap-1">
					{ACTIONS[item.status].map((action) => (
						<Button
							key={action.to}
							size="sm"
							variant={action.to === "new" ? "ghost" : "secondary"}
							loading={pendingStatus === action.to}
							disabled={pending && pendingStatus !== action.to}
							aria-describedby={headingId}
							data-id={`${itemId}-${action.to}`}
							onClick={() => onStatus(item, action.to)}
						>
							{t(`admin.inbox.actions.${action.key}`)}
						</Button>
					))}
					<Button
						size="sm"
						variant="ghost"
						disabled={pending}
						aria-describedby={headingId}
						data-id={`${itemId}-delete`}
						leadingIcon={<IconTrash size={16} aria-hidden="true" />}
						onClick={() => onDelete(item)}
					>
						{t("common.actions.delete")}
					</Button>
				</span>
			</div>
		</li>
	);
}
