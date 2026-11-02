import { IconBell } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { useFeatures } from "../../config/features";
import { DeleteAccountSection } from "../../features/account-deletion/delete-account-section";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { NOTIFICATION_SETTINGS_PATH } from "../../features/notifications/notification-bell";
import {
	type AccountUsage,
	fetchAccountUsage,
} from "../../features/usage/account-usage-api";
import { UsageMetersSkeleton } from "../../features/usage/usage-meters-skeleton";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { useAppTitle } from "../../lib/use-document-title";
import { AccountMeters } from "./account-meters";

type UsageState =
	| { status: "loading" }
	| { status: "ready"; usage: AccountUsage }
	| { status: "error"; error: unknown };

/**
 * `/account`: this month's meters and, last, deleting the account.
 * Every account has the same limits: no plan, price or upgrade.
 */
export function AccountPage() {
	const t = useT();
	useAppTitle(t("account.title"));
	const flags = useFeatures();
	const session = useCurrentUser();
	const [state, setState] = useState<UsageState>({ status: "loading" });
	// Held its minimum time even when the usage comes back sooner.
	const skeleton = useDelayedFlag(state.status === "loading");

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

	const usage = state.status === "ready" ? state.usage : null;
	return (
		<section data-id="account" className="grid gap-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="m-0 flex min-h-11 items-center font-bold font-mono text-xl">
					{t("account.title")}
				</h1>
				<Link
					to={NOTIFICATION_SETTINGS_PATH}
					data-id="account-notify-settings"
					className={cn(buttonClassName(), "no-underline")}
				>
					<IconBell size={16} aria-hidden="true" />
					{t("account.notificationChannels")}
				</Link>
			</div>
			{skeleton ? (
				<UsageMetersSkeleton
					data-id="account-meters-loading"
					label={t("account.usage.loading")}
					count={flags.apiClient ? 3 : 2}
					className="grid gap-4 md:grid-cols-2"
				/>
			) : null}
			{state.status === "error" && !skeleton ? (
				<div
					data-id="account-meters-error"
					className="grid justify-items-start gap-3"
				>
					<Alert tone="danger" title={t("account.usage.loadFailed")}>
						{errorMessage(state.error)}
					</Alert>
					<Button onClick={() => void load()}>{t("common.cta.retry")}</Button>
				</div>
			) : null}
			{usage && !skeleton ? <AccountMeters usage={usage} /> : null}
			{session.status === "authenticated" && session.user.username ? (
				<DeleteAccountSection username={session.user.username} />
			) : null}
		</section>
	);
}
