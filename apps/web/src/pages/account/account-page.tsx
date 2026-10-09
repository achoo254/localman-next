import { limitsFor } from "@localman/shared/constants";
import { IconBell } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useFeatures } from "../../config/features";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { NOTIFICATION_SETTINGS_PATH } from "../../features/notifications/notification-bell";
import {
	type AccountUsage,
	fetchAccountUsage,
} from "../../features/subscription/account-usage-api";
import { UsageMeter } from "../../features/subscription/usage-meter";
import { useSubscriptionDialogs } from "../../features/subscription/use-subscription-dialogs";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { formatDate, nextPeriodStart } from "../../lib/format";
import { useAppTitle } from "../../lib/use-document-title";

type UsageState =
	| { status: "loading" }
	| { status: "ready"; usage: AccountUsage }
	| { status: "error"; error: unknown };

const PLAN_NAME = { free: "Free", pro: "Pro" } as const;

/** `/account`: current plan and this month's quota meters. */
export function AccountPage() {
	useAppTitle("Tài khoản");
	const session = useCurrentUser();
	const user = session.status === "authenticated" ? session.user : null;
	const [state, setState] = useState<UsageState>({ status: "loading" });
	const plan =
		state.status === "ready" ? state.usage.plan : (user?.plan ?? "free");
	const subscription = useSubscriptionDialogs(plan, "account");
	const limits = limitsFor(plan);

	const load = useCallback(async () => {
		setState({ status: "loading" });
		try {
			setState({ status: "ready", usage: await fetchAccountUsage() });
		} catch (error) {
			setState({ status: "error", error });
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const expires =
		state.status === "ready" && state.usage.planExpiresAt
			? ` · hết hạn ${formatDate(state.usage.planExpiresAt)}`
			: "";

	return (
		<section data-id="account" className="grid gap-5">
			<h1 className="m-0 flex min-h-11 items-center font-bold font-mono text-xl">
				Tài khoản
			</h1>
			<section
				data-id="account-plan"
				className={cn(
					cardClassName,
					"flex flex-wrap items-center justify-between gap-3 p-6",
				)}
			>
				<div className="grid gap-1">
					<h2 className="m-0 font-bold font-mono text-base">
						Gói {PLAN_NAME[plan]}
						{expires}
					</h2>
					<p className="m-0 text-muted text-sm">
						{user?.email ? `${user.email} · ` : ""}
						{limits.projects} project, {limits.resources} resource mỗi project,
						tối đa {limits.membersPerWorkspace} thành viên mỗi project.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Link
						to={NOTIFICATION_SETTINGS_PATH}
						data-id="account-notify-settings"
						className={cn(buttonClassName(), "no-underline")}
					>
						<IconBell size={16} aria-hidden="true" />
						Kênh thông báo
					</Link>
					<Button
						variant="primary"
						data-id="account-plan-manage"
						onClick={() => subscription.openPlans()}
					>
						Quản lý gói
					</Button>
				</div>
			</section>
			{state.status === "loading" ? (
				<output className="block font-mono text-muted text-sm">
					Đang tải hạn mức…
				</output>
			) : null}
			{state.status === "error" ? (
				<div
					data-id="account-meters-error"
					className="grid justify-items-start gap-3"
				>
					<Alert tone="danger" title="Không tải được hạn mức">
						{errorMessage(state.error)}
					</Alert>
					<Button onClick={() => void load()}>Thử lại</Button>
				</div>
			) : null}
			{state.status === "ready" ? <AccountMeters usage={state.usage} /> : null}
			{subscription.element}
		</section>
	);
}

/**
 * Quota meters. The proxy meter and the "MCP counts too" note wait for the
 * API client and Mock MCP to reach production.
 */
function AccountMeters({ usage }: { usage: AccountUsage }) {
	const flags = useFeatures();
	const reset = nextPeriodStart(usage.period);
	const mockNote = flags.mockMcp
		? `REST và MCP đều tính. Đặt lại ngày ${reset}.`
		: `Tính mọi request REST tới mock. Đặt lại ngày ${reset}.`;
	return (
		<div data-id="account-meters" className="grid gap-4 md:grid-cols-2">
			<UsageMeter
				data-id="account-meter-projects"
				label="Projects"
				counter={usage.projects}
				note="Tính project bạn sở hữu, không tính project được mời."
			/>
			<UsageMeter
				data-id="account-meter-mock-requests"
				label="Request tới mock tháng này"
				counter={usage.mockRequests}
				note={mockNote}
			/>
			{flags.apiClient ? (
				<UsageMeter
					data-id="account-meter-proxy-requests"
					label="Request qua proxy tháng này"
					counter={usage.proxyRequests}
					note={`Request gửi từ API client, kể cả qua Tunelo. Đặt lại ngày ${reset}.`}
				/>
			) : null}
		</div>
	);
}
