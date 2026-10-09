import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { AuthStatus } from "../../features/auth/auth-status";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/format";
import { useAppTitle } from "../../lib/use-document-title";
import { AdminNav } from "./admin-nav";
import type { ContactMessage } from "./feedback-inbox-api";
import { FeedbackInboxFilters } from "./feedback-inbox-filters";
import { FeedbackInboxItem, senderLabel } from "./feedback-inbox-item";
import { Pagination } from "./pagination";
import { AdminForbidden } from "./pro-interest-page";
import { useFeedbackInbox } from "./use-feedback-inbox";

/** `/admin/feedback`: messages from the "Góp ý / Liên hệ" form. */
export function FeedbackInboxPage() {
	useAppTitle("Quản trị · Hộp thư góp ý");
	const session = useCurrentUser();
	if (session.status !== "authenticated") return <AuthStatus kind="loading" />;
	if (!session.user.isOwner) return <AdminForbidden />;
	return <FeedbackInbox />;
}

function FeedbackInbox() {
	const inbox = useFeedbackInbox();
	const { state } = inbox;
	const [deleting, setDeleting] = useState<ContactMessage | null>(null);

	if (inbox.forbidden) return <AdminForbidden />;

	return (
		<section data-id="admin-feedback" className="grid gap-4">
			<div className="flex min-h-11 flex-wrap items-center gap-3">
				<h1 className="m-0 font-bold font-mono text-xl">
					Quản trị · Hộp thư góp ý
				</h1>
				<Badge tone="accent">Chỉ chủ sở hữu</Badge>
			</div>
			<AdminNav />
			<section
				data-id="admin-feedback-list"
				aria-label="Hộp thư góp ý"
				aria-busy={state.status === "loading"}
				className={cn(cardClassName, "overflow-hidden")}
			>
				<FeedbackInboxFilters
					filter={inbox.filter}
					onChange={inbox.changeFilter}
					countLabel={`${formatNumber(inbox.total)} tin`}
				/>
				{state.status === "loading" ? (
					<output className="block px-5 py-6 font-mono text-muted text-sm">
						Đang tải hộp thư…
					</output>
				) : null}
				{state.status === "error" ? (
					<div className="grid justify-items-start gap-3 px-5 py-6">
						<Alert tone="danger">{errorMessage(state.error)}</Alert>
						<Button onClick={inbox.refresh}>Thử lại</Button>
					</div>
				) : null}
				{state.status === "ready" && state.page.items.length === 0 ? (
					<p
						data-id="admin-feedback-empty"
						className="m-0 px-5 py-7 text-center text-muted"
					>
						Không có tin nào khớp bộ lọc.
					</p>
				) : null}
				{state.status === "ready" && state.page.items.length > 0 ? (
					<ul className="m-0 list-none p-0">
						{state.page.items.map((item) => (
							<FeedbackInboxItem
								key={item.id}
								item={item}
								pending={inbox.pendingId === item.id}
								onStatus={(row, status) => void inbox.changeStatus(row, status)}
								onDelete={setDeleting}
							/>
						))}
					</ul>
				) : null}
				<Pagination
					page={inbox.page}
					pages={inbox.pages}
					onPage={inbox.setPage}
				/>
			</section>
			{deleting ? (
				<ConfirmModal
					open
					onOpenChange={(open) => !open && setDeleting(null)}
					title="Xoá tin"
					data-id="modal-feedback-delete"
					question={`Xoá tin của ${senderLabel(deleting)}?`}
					confirmLabel="Xoá vĩnh viễn"
					onConfirm={() => inbox.remove(deleting)}
				>
					<span>
						Nội dung, tên và địa chỉ liên hệ của tin này bị xoá hẳn. Không hoàn
						tác được.
					</span>
				</ConfirmModal>
			) : null}
		</section>
	);
}
