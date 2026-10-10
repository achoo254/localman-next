import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useFeatures } from "../../config/features";
import { useCurrentUser } from "../../features/auth/use-current-user";
import {
	type AccountUsage,
	fetchAccountUsage,
} from "../../features/subscription/account-usage-api";
import { OverLimitsBanner } from "../../features/subscription/over-limits-banner";
import { useStartTrial } from "../../features/subscription/start-trial-dialog";
import { TrialExtensionForm } from "../../features/subscription/trial-extension-form";
import { UsageMetersSkeleton } from "../../features/subscription/usage-meters-skeleton";
import { useSubscriptionDialogs } from "../../features/subscription/use-subscription-dialogs";
import { useI18n } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { useAppTitle } from "../../lib/use-document-title";
import { AccountMeters } from "./account-meters";
import { AccountPlanCard } from "./account-plan-card";

type UsageState =
	| { status: "loading" }
	| { status: "ready"; usage: AccountUsage }
	| { status: "error"; error: unknown };

/**
 * `/account`: current plan (with the Pro trial and its extension
 * requests), the limits the account is above, and this month's meters.
 */
export function AccountPage() {
	const { t } = useI18n();
	useAppTitle(t("account.title"));
	const session = useCurrentUser();
	const flags = useFeatures();
	const user = session.status === "authenticated" ? session.user : null;
	const [state, setState] = useState<UsageState>({ status: "loading" });
	// Held its minimum time even when the usage comes back sooner.
	const skeleton = useDelayedFlag(state.status === "loading");
	const plan =
		state.status === "ready" ? state.usage.plan : (user?.plan ?? "free");
	const subscription = useSubscriptionDialogs(plan, "account");
	const trial = useStartTrial();

	/** `quiet` keeps the meters on screen while they refresh. */
	const load = useCallback(async (quiet = false) => {
		if (!quiet) setState({ status: "loading" });
		try {
			setState({ status: "ready", usage: await fetchAccountUsage() });
		} catch (error) {
			setState({ status: "error", error });
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	// Starting or extending the trial changes the plan in force: refresh the
	// usage so the plan name, the banner and the meters follow.
	const trialKey = user
		? `${user.plan}|${user.trial.status}|${user.trial.endsAt ?? ""}`
		: null;
	const seenTrialKey = useRef(trialKey);
	useEffect(() => {
		if (seenTrialKey.current === trialKey) return;
		const firstAnswer = seenTrialKey.current === null;
		seenTrialKey.current = trialKey;
		if (!firstAnswer) void load(true);
	}, [trialKey, load]);

	const usage = state.status === "ready" ? state.usage : null;
	return (
		<section data-id="account" className="grid gap-5">
			<h1 className="m-0 flex min-h-11 items-center font-bold font-mono text-xl">
				{t("account.title")}
			</h1>
			<AccountPlanCard
				plan={plan}
				expiresAt={usage?.planExpiresAt ?? null}
				user={user}
				onManage={() => subscription.openPlans()}
				onStartTrial={trial.open}
			/>
			{usage && !skeleton ? (
				<OverLimitsBanner plan={usage.plan} overLimits={usage.overLimits} />
			) : null}
			{user ? <TrialExtensionForm trial={user.trial} /> : null}
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
			{subscription.element}
			{trial.element}
		</section>
	);
}
