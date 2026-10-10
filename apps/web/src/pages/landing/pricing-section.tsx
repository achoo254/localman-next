import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { ProInterestModal } from "../../features/subscription/pro-interest-modal";
import { useStartTrial } from "../../features/subscription/start-trial-dialog";
import { trialView } from "../../features/subscription/trial-state";
import { useT } from "../../i18n/i18n-context";
import { LandingSection } from "./landing-section";
import { PricingTable } from "./pricing-table";

export interface PricingSectionProps {
	/** 1 on the `/pricing` page, where the block is the page; 2 on the landing. */
	headingLevel?: 1 | 2;
}

/**
 * "Pricing": the two plan cards, the note, the Pro trial confirmation and
 * the Pro interest form, on the landing and on `/pricing`. A signed-in
 * user's plan is marked as current.
 */
export function PricingSection({ headingLevel = 2 }: PricingSectionProps) {
	const [interestOpen, setInterestOpen] = useState(false);
	const session = useCurrentUser();
	const user = session.status === "authenticated" ? session.user : null;
	const trial = useStartTrial();
	const t = useT();
	useResumeTrialStart(
		session.status,
		user ? trialView(user) : null,
		trial.open,
	);
	return (
		<LandingSection
			id="pricing"
			data-id="landing-pricing"
			eyebrow={t("landing.pricing.eyebrow")}
			title={t("landing.pricing.title")}
			headingLevel={headingLevel}
		>
			<div className="grid gap-4">
				<PricingTable
					onContactPro={() => setInterestOpen(true)}
					onStartTrial={trial.open}
					user={user}
				/>
				<p
					data-id="landing-pricing-note"
					className="m-0 max-w-220 text-[0.8125rem] text-muted"
				>
					{t("landing.pricing.rateNote")}
				</p>
			</div>
			<ProInterestModal
				open={interestOpen}
				onOpenChange={setInterestOpen}
				source="landing"
			/>
			{trial.element}
		</LandingSection>
	);
}

/**
 * A visitor who chose "Start free trial" signs in and comes back with
 * `?trial=start`: once the session is known, open the confirmation if the
 * trial is still there to start, and drop the parameter either way so a
 * reload does not ask again.
 */
function useResumeTrialStart(
	sessionStatus: ReturnType<typeof useCurrentUser>["status"],
	view: ReturnType<typeof trialView> | null,
	open: () => void,
): void {
	const [params, setParams] = useSearchParams();
	const requested = params.get("trial") === "start";
	useEffect(() => {
		if (!requested || sessionStatus === "loading") return;
		if (view === "available") open();
		setParams(
			(current) => {
				current.delete("trial");
				return current;
			},
			{ replace: true, preventScrollReset: true },
		);
	}, [requested, sessionStatus, view, open, setParams]);
}
