import { type PlanId, limitsFor } from "@localman/shared/constants";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button, buttonClassName } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { Translate } from "../../i18n/translate";
import { cn } from "../../lib/cn";
import { useKnownCurrentUser } from "../auth/use-current-user";
import { AppLink } from "./app-link";
import { PlanCard } from "./plan-card";
import type { ProInterestSource } from "./pro-interest-options";
import { ProTrialAction } from "./pro-trial-action";
import { useStartTrial } from "./start-trial-dialog";
import { AVAILABLE_TRIAL, type TrialViewer } from "./trial-state";

/** Which quota sent the user here; null when opened to compare plans. */
export type LimitReason = "projects" | "resources" | "members" | "proxy" | null;

export interface ManageSubscriptionModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	plan: PlanId;
	reason: LimitReason;
	/** Source recorded when opened without a limit (header menu, account page). */
	manageSource?: ProInterestSource;
	/** Secondary link of the Pro card: the Pro interest form from this source. */
	onContact: (source: ProInterestSource) => void;
}

const PLAN_NAME = { free: "Free", pro: "Pro" } as const;

function limitText(
	plan: PlanId,
	reason: Exclude<LimitReason, null>,
	t: Translate,
): string {
	const limits = limitsFor(plan);
	if (reason === "projects") {
		return t("subscription.manage.limit.projects", { count: limits.projects });
	}
	if (reason === "resources") {
		return t("subscription.manage.limit.resources", {
			count: limits.resources,
		});
	}
	if (reason === "members") {
		return t("subscription.manage.limit.members", {
			count: limits.membersPerWorkspace,
		});
	}
	const proxy = limits.proxyRequestsPerMonth;
	return proxy === null
		? t("subscription.manage.limit.proxyAny")
		: t("subscription.manage.limit.proxy", { count: proxy });
}

const SOURCE: Record<Exclude<LimitReason, null>, ProInterestSource> = {
	projects: "plan_limit_projects",
	resources: "plan_limit_resources",
	members: "plan_limit_members",
	proxy: "plan_limit_proxy",
};

/** The session's user, or the `plan` the caller knows while it is unknown. */
function useViewer(plan: PlanId): TrialViewer {
	const session = useKnownCurrentUser();
	return session.status === "authenticated"
		? session.user
		: { plan, trial: AVAILABLE_TRIAL };
}

/**
 * "Manage plan": why the limit was hit, the Free/Pro comparison with the
 * Pro trial by its state, and a link to the full pricing page. Starting the
 * trial closes this dialog for the confirmation.
 */
export function ManageSubscriptionModal({
	open,
	onOpenChange,
	plan,
	reason,
	manageSource = "subscription_modal",
	onContact,
}: ManageSubscriptionModalProps) {
	const t = useT();
	const source = reason ? SOURCE[reason] : manageSource;
	const viewer = useViewer(plan);
	const trial = useStartTrial();
	const close = () => onOpenChange(false);
	const current = (
		<Badge data-id="modal-subscription-current">
			{t("subscription.manage.currentBadge")}
		</Badge>
	);
	return (
		<>
			<Modal
				open={open}
				onOpenChange={onOpenChange}
				title={t("subscription.manage.title")}
				size="lg"
				initialFocusRef="dialog"
				data-id="modal-subscription"
				footer={
					<ModalFooter>
						<AppLink
							to="/pricing"
							data-id="modal-subscription-pricing"
							onClick={close}
							className={cn(buttonClassName(), "no-underline")}
						>
							{t("subscription.manage.seePricing")}
						</AppLink>
						<ModalClose asChild>
							<Button data-id="modal-subscription-close">
								{t("common.actions.close")}
							</Button>
						</ModalClose>
					</ModalFooter>
				}
			>
				{reason ? (
					<Alert
						tone="warning"
						data-id="modal-subscription-reason"
						title={t("subscription.manage.reachedTitle", {
							plan: PLAN_NAME[plan],
							limit: limitText(plan, reason, t),
						})}
					>
						{t("subscription.manage.reachedText")}
					</Alert>
				) : (
					<p
						data-id="modal-subscription-reason"
						className="m-0 text-[0.8125rem] text-muted"
					>
						{renderRich(
							t("subscription.manage.current", { plan: PLAN_NAME[plan] }),
							{ b: (chunk) => <b className="text-fg">{chunk}</b> },
						)}
					</p>
				)}
				<div
					data-id="modal-subscription-plans"
					className="grid gap-3 sm:grid-cols-2"
				>
					<PlanCard
						data-id="modal-subscription-free"
						name="Free"
						limits={limitsFor("free")}
						badge={viewer.plan === "free" ? current : null}
					/>
					<PlanCard
						data-id="modal-subscription-pro"
						name="Pro"
						featured
						limits={limitsFor("pro")}
						badge={viewer.plan === "pro" ? current : null}
						lead={t("subscription.manage.proLead")}
						action={
							<ProTrialAction
								data-id="modal-subscription-pro"
								user={viewer}
								onStart={() => {
									close();
									trial.open();
								}}
								onTellUs={() => onContact(source)}
								onNavigate={close}
							/>
						}
					/>
				</div>
			</Modal>
			{trial.element}
		</>
	);
}
