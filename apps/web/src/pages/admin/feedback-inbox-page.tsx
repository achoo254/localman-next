import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { PanelProgress } from "../../components/ui/panel-progress";
import { AuthStatus } from "../../features/auth/auth-status";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { useAppTitle } from "../../lib/use-document-title";
import { AdminNav } from "./admin-nav";
import { AdminListSkeleton } from "./admin-skeletons";
import type { ContactMessage } from "./feedback-inbox-api";
import { FeedbackInboxFilters } from "./feedback-inbox-filters";
import { FeedbackInboxItem, senderLabel } from "./feedback-inbox-item";
import { Pagination } from "./pagination";
import { AdminForbidden } from "./pro-interest-page";
import { useFeedbackInbox } from "./use-feedback-inbox";

/** `/admin/feedback`: messages from the "Feedback / Contact" form. */
export function FeedbackInboxPage() {
	const t = useT();
	useAppTitle(t("admin.heading", { page: t("admin.nav.feedback") }));
	const session = useCurrentUser();
	if (session.status !== "authenticated") return <AuthStatus kind="loading" />;
	if (!session.user.isOwner) return <AdminForbidden />;
	return <FeedbackInbox />;
}

function FeedbackInbox() {
	const t = useT();
	const inbox = useFeedbackInbox();
	const { state } = inbox;
	const [deleting, setDeleting] = useState<ContactMessage | null>(null);
	// First load only; later pages and filters keep the list under a bar.
	const skeleton = useDelayedFlag(state.status === "loading");
	const refreshing = inbox.fetching && state.status === "ready";

	if (inbox.forbidden) return <AdminForbidden />;

	return (
		<section data-id="admin-feedback" className="grid gap-4">
			<div className="flex min-h-11 flex-wrap items-center gap-3">
				<h1 className="m-0 font-bold font-mono text-xl">
					{t("admin.heading", { page: t("admin.nav.feedback") })}
				</h1>
				<Badge tone="accent">{t("admin.ownerOnly")}</Badge>
			</div>
			<AdminNav />
			<section
				data-id="admin-feedback-list"
				aria-label={t("admin.nav.feedback")}
				aria-busy={inbox.fetching}
				className={cn(cardClassName, "overflow-hidden")}
			>
				<FeedbackInboxFilters
					filter={inbox.filter}
					onChange={inbox.changeFilter}
					countLabel={t("admin.inbox.count", { count: inbox.total })}
				/>
				{skeleton ? (
					<AdminListSkeleton
						data-id="admin-feedback-loading"
						label={t("admin.inbox.loading")}
					/>
				) : null}
				{state.status === "error" && !skeleton ? (
					<div className="grid justify-items-start gap-3 px-5 py-6">
						<Alert tone="danger">{errorMessage(state.error)}</Alert>
						<Button onClick={inbox.refresh}>{t("common.cta.retry")}</Button>
					</div>
				) : null}
				<PanelProgress active={refreshing} dim>
					{state.status === "ready" &&
					!skeleton &&
					state.page.items.length === 0 ? (
						<p
							data-id="admin-feedback-empty"
							className="m-0 px-5 py-7 text-center text-muted"
						>
							{t("admin.inbox.empty")}
						</p>
					) : null}
					{state.status === "ready" &&
					!skeleton &&
					state.page.items.length > 0 ? (
						<ul className="m-0 list-none p-0">
							{state.page.items.map((item) => (
								<FeedbackInboxItem
									key={item.id}
									item={item}
									pendingStatus={
										inbox.pending?.id === item.id ? inbox.pending.status : null
									}
									onStatus={(row, status) =>
										void inbox.changeStatus(row, status)
									}
									onDelete={setDeleting}
								/>
							))}
						</ul>
					) : null}
				</PanelProgress>
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
					title={t("admin.inbox.deleteTitle")}
					data-id="modal-feedback-delete"
					question={t("admin.inbox.deleteQuestion", {
						sender: senderLabel(t, deleting),
					})}
					confirmLabel={t("admin.deletePermanently")}
					onConfirm={() => inbox.remove(deleting)}
				>
					<span>{t("admin.inbox.deleteBody")}</span>
				</ConfirmModal>
			) : null}
		</section>
	);
}
