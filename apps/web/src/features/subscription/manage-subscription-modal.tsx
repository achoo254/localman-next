import { type PlanId, limitsFor } from "@localman/shared/constants";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { formatNumber } from "../../lib/format";
import { PlanCard } from "./plan-card";
import type { ProInterestSource } from "./pro-interest-options";

/** Which quota sent the user here; null when opened to compare plans. */
export type LimitReason = "projects" | "resources" | "proxy" | null;

export interface ManageSubscriptionModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	plan: PlanId;
	reason: LimitReason;
	/** Source recorded when opened without a limit (header menu, account page). */
	manageSource?: ProInterestSource;
	/** "Liên hệ nâng cấp": opens the Pro interest form from this source. */
	onContact: (source: ProInterestSource) => void;
}

const PLAN_NAME = { free: "Free", pro: "Pro" } as const;

function limitText(plan: PlanId, reason: Exclude<LimitReason, null>): string {
	const limits = limitsFor(plan);
	if (reason === "projects") return `${limits.projects} project`;
	if (reason === "resources") return `${limits.resources} resource`;
	const proxy = limits.proxyRequestsPerMonth;
	return proxy === null
		? "request qua proxy"
		: `${formatNumber(proxy)} request qua proxy mỗi tháng`;
}

const SOURCE: Record<Exclude<LimitReason, null>, ProInterestSource> = {
	projects: "plan_limit_projects",
	resources: "plan_limit_resources",
	proxy: "plan_limit_proxy",
};

/** "Quản lý gói": why the limit was hit and the Free/Pro comparison. */
export function ManageSubscriptionModal({
	open,
	onOpenChange,
	plan,
	reason,
	manageSource = "subscription_modal",
	onContact,
}: ManageSubscriptionModalProps) {
	const source = reason ? SOURCE[reason] : manageSource;
	const current = (
		<Badge data-id="modal-subscription-current">Gói hiện tại</Badge>
	);
	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="Quản lý gói"
			size="lg"
			initialFocusRef="dialog"
			data-id="modal-subscription"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button data-id="modal-subscription-close">Đóng</Button>
					</ModalClose>
				</ModalFooter>
			}
		>
			{reason ? (
				<Alert
					tone="warning"
					data-id="modal-subscription-reason"
					title={`Bạn đã đạt giới hạn gói ${PLAN_NAME[plan]}: ${limitText(plan, reason)}`}
				>
					So sánh hai gói bên dưới.
				</Alert>
			) : (
				<p
					data-id="modal-subscription-reason"
					className="m-0 text-[0.8125rem] text-muted"
				>
					Gói hiện tại: <b className="text-fg">{PLAN_NAME[plan]}</b>. Hạn mức
					từng gói bên dưới.
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
					badge={plan === "free" ? current : null}
				/>
				<PlanCard
					data-id="modal-subscription-pro"
					name="Pro"
					featured
					limits={limitsFor("pro")}
					badge={plan === "pro" ? current : null}
					lead="Hạn mức lớn hơn cho team và dự án thật."
					action={
						plan === "free" ? (
							<Button
								variant="primary"
								block
								data-id="modal-subscription-pro-contact"
								onClick={() => onContact(source)}
							>
								Liên hệ nâng cấp
							</Button>
						) : null
					}
				/>
			</div>
			<p className="m-0 text-muted text-[0.8125rem]">
				Gói Pro chưa mở thanh toán. Bấm Liên hệ nâng cấp để để lại nhu cầu,
				chúng tôi sẽ liên hệ khi gói Pro sẵn sàng.
			</p>
		</Modal>
	);
}
