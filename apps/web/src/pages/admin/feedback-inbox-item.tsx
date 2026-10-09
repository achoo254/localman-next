import { IconTrash } from "@tabler/icons-react";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { FEEDBACK_CATEGORIES } from "../../features/feedback/feedback-draft";
import { formatDate } from "../../lib/format";
import type { ContactMessage, MessageStatus } from "./feedback-inbox-api";

export const STATUS_LABELS: Readonly<
	Record<MessageStatus, { label: string; tone: BadgeTone }>
> = {
	new: { label: "Mới", tone: "accent" },
	read: { label: "Đã đọc", tone: "info" },
	resolved: { label: "Đã xử lý", tone: "success" },
};

const SOURCE_LABELS: Readonly<Record<string, string>> = {
	landing: "Trang chủ",
	projects: "Projects",
	account: "Tài khoản",
	admin: "Quản trị",
	invite: "Lời mời",
	docs: "Docs",
	other: "Khác",
};

/** Next steps offered for each status. */
const ACTIONS: Readonly<
	Record<MessageStatus, readonly { to: MessageStatus; label: string }[]>
> = {
	new: [
		{ to: "read", label: "Đánh dấu đã đọc" },
		{ to: "resolved", label: "Đánh dấu đã xử lý" },
	],
	read: [
		{ to: "resolved", label: "Đánh dấu đã xử lý" },
		{ to: "new", label: "Đánh dấu chưa đọc" },
	],
	resolved: [{ to: "new", label: "Mở lại" }],
};

export function categoryLabel(id: string): string {
	return FEEDBACK_CATEGORIES.find((choice) => choice.id === id)?.label ?? id;
}

/** Who sent it: the name left, else whether it came from an account. */
export function senderLabel(item: ContactMessage): string {
	return item.name ?? (item.userSub ? "Người dùng" : "Khách");
}

export interface FeedbackInboxItemProps {
	item: ContactMessage;
	pending: boolean;
	onStatus: (item: ContactMessage, status: MessageStatus) => void;
	onDelete: (item: ContactMessage) => void;
}

/** One message: who, where from, the full text, and follow-up actions. */
export function FeedbackInboxItem({
	item,
	pending,
	onStatus,
	onDelete,
}: FeedbackInboxItemProps) {
	const itemId = `admin-feedback-item-${item.id}`;
	const headingId = `${itemId}-heading`;
	const status = STATUS_LABELS[item.status];
	const sender = senderLabel(item);
	return (
		<li
			data-id={itemId}
			className="grid gap-3 border-border-subtle border-b px-5 py-4 last:border-b-0"
		>
			<div className="flex flex-wrap items-center gap-2">
				<h2 id={headingId} className="m-0 font-mono font-semibold text-sm">
					{categoryLabel(item.category)} · {sender}
				</h2>
				<Badge tone={status.tone} data-id={`${itemId}-status`}>
					{status.label}
				</Badge>
				{item.userSub ? <Badge>Đã đăng nhập</Badge> : null}
				<span className="ml-auto font-mono text-[0.8125rem] text-muted">
					{formatDate(item.createdAt)} ·{" "}
					{SOURCE_LABELS[item.source] ?? item.source}
				</span>
			</div>
			<p className="m-0 whitespace-pre-wrap break-words text-fg text-sm">
				{item.message}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-mono text-[0.8125rem] text-muted">
					{item.contact
						? `${item.contactKind === "telegram" ? "Telegram" : "Email"}: ${item.contact}`
						: "Không để lại liên hệ"}
				</span>
				<span className="ml-auto flex flex-wrap gap-1">
					{ACTIONS[item.status].map((action) => (
						<Button
							key={action.to}
							size="sm"
							variant={action.to === "new" ? "ghost" : "secondary"}
							disabled={pending}
							aria-describedby={headingId}
							data-id={`${itemId}-${action.to}`}
							onClick={() => onStatus(item, action.to)}
						>
							{action.label}
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
						Xoá
					</Button>
				</span>
			</div>
		</li>
	);
}
