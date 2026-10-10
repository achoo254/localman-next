import { TRIAL_EXTENSION_DAYS } from "@localman/shared/constants";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { FormField } from "../../components/ui/form-field";
import { PanelProgress } from "../../components/ui/panel-progress";
import { Select } from "../../components/ui/select";
import { AuthStatus } from "../../features/auth/auth-status";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { useAppTitle } from "../../lib/use-document-title";
import { AdminNav } from "./admin-nav";
import { AdminListSkeleton } from "./admin-skeletons";
import { ExtendTrialForm } from "./extend-trial-form";
import { Pagination } from "./pagination";
import { AdminForbidden } from "./pro-interest-page";
import { TrialExtensionItem } from "./trial-extension-item";
import {
	type TrialExtensionItem as Item,
	requesterLabel,
} from "./trial-extensions-api";
import { useTrialExtensions } from "./use-trial-extensions";

/** `/admin/trial-extensions`: Pro trial extension requests and direct extensions. */
export function TrialExtensionsPage() {
	const t = useT();
	useAppTitle(t("admin.heading", { page: t("admin.nav.trialExtensions") }));
	const session = useCurrentUser();
	if (session.status !== "authenticated") return <AuthStatus kind="loading" />;
	if (!session.user.isOwner) return <AdminForbidden />;
	return <TrialExtensions />;
}

interface Decision {
	item: Item;
	decision: "approve" | "decline";
}

function TrialExtensions() {
	const t = useT();
	const list = useTrialExtensions();
	const { state } = list;
	const [deciding, setDeciding] = useState<Decision | null>(null);
	// First load only; later pages and filters keep the list under a bar.
	const skeleton = useDelayedFlag(state.status === "loading");
	const refreshing = list.fetching && state.status === "ready";
	const items = state.status === "ready" && !skeleton ? state.page.items : null;

	if (list.forbidden) return <AdminForbidden />;

	return (
		<section data-id="admin-trial" className="grid gap-4">
			<div className="flex min-h-11 flex-wrap items-center gap-3">
				<h1 className="m-0 font-bold font-mono text-xl">
					{t("admin.heading", { page: t("admin.nav.trialExtensions") })}
				</h1>
				<Badge tone="accent">{t("admin.ownerOnly")}</Badge>
			</div>
			<AdminNav />
			<section
				data-id="admin-trial-list"
				aria-label={t("admin.nav.trialExtensions")}
				aria-busy={list.fetching}
				className={cn(cardClassName, "overflow-hidden")}
			>
				<div className="flex flex-wrap items-end gap-3 border-border-subtle border-b px-5 py-4">
					<FormField
						label={t("admin.status")}
						data-id="admin-trial-filter"
						className="min-w-0 flex-[0_1_12rem]"
					>
						<Select
							value={list.filter}
							onChange={(event) =>
								list.changeFilter(
									event.target.value === "all" ? "all" : "pending",
								)
							}
						>
							<option value="pending">{t("admin.trial.filterPending")}</option>
							<option value="all">{t("common.all")}</option>
						</Select>
					</FormField>
				</div>
				{skeleton ? (
					<AdminListSkeleton
						data-id="admin-trial-loading"
						label={t("admin.trial.loading")}
					/>
				) : null}
				{state.status === "error" && !skeleton ? (
					<div className="grid justify-items-start gap-3 px-5 py-6">
						<Alert tone="danger">{errorMessage(state.error)}</Alert>
						<Button onClick={list.refresh}>{t("common.cta.retry")}</Button>
					</div>
				) : null}
				<PanelProgress active={refreshing} dim>
					{items && items.length === 0 ? (
						<p
							data-id="admin-trial-empty"
							className="m-0 px-5 py-7 text-center text-muted"
						>
							{list.filter === "pending"
								? t("admin.trial.emptyPending")
								: t("admin.trial.empty")}
						</p>
					) : null}
					{items && items.length > 0 ? (
						<ul className="m-0 list-none p-0">
							{items.map((item) => (
								<TrialExtensionItem
									key={item.id}
									item={item}
									onDecide={(row, decision) =>
										setDeciding({ item: row, decision })
									}
								/>
							))}
						</ul>
					) : null}
				</PanelProgress>
				<Pagination page={list.page} pages={list.pages} onPage={list.setPage} />
			</section>
			<ExtendTrialForm onExtended={list.refresh} />
			{deciding ? (
				<DecisionModal
					decision={deciding}
					onClose={() => setDeciding(null)}
					onConfirm={() => list.decide(deciding.item, deciding.decision)}
				/>
			) : null}
		</section>
	);
}

function DecisionModal({
	decision: { item, decision },
	onClose,
	onConfirm,
}: {
	decision: Decision;
	onClose: () => void;
	onConfirm: () => Promise<void>;
}) {
	const t = useT();
	const user = requesterLabel(item);
	const approve = decision === "approve";
	return (
		<ConfirmModal
			open
			onOpenChange={(open) => !open && onClose()}
			title={
				approve ? t("admin.trial.approveTitle") : t("admin.trial.declineTitle")
			}
			data-id={`modal-trial-${decision}`}
			question={
				approve
					? t("admin.trial.approveQuestion", {
							user,
							days: TRIAL_EXTENSION_DAYS,
						})
					: t("admin.trial.declineQuestion", { user })
			}
			confirmLabel={
				approve ? t("admin.trial.approve") : t("admin.trial.decline")
			}
			onConfirm={onConfirm}
		>
			<span className="whitespace-pre-wrap break-words">{item.reason}</span>
			<span>
				{approve ? t("admin.trial.approveBody") : t("admin.trial.declineBody")}
			</span>
		</ConfirmModal>
	);
}
