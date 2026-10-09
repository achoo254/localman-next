import type { PlanId } from "@localman/shared";
import { type ReactNode, useCallback, useState } from "react";
import {
	type LimitReason,
	ManageSubscriptionModal,
} from "./manage-subscription-modal";
import { ProInterestModal } from "./pro-interest-modal";
import type { ProInterestSource } from "./pro-interest-options";

export interface SubscriptionDialogs {
	/** Opens "Quản lý gói"; pass the quota that was hit, if any. */
	openPlans: (reason?: LimitReason) => void;
	openProInterest: (source: ProInterestSource) => void;
	/** Render once in the page that uses the dialogs. */
	element: ReactNode;
}

/**
 * Plans modal and Pro interest form wired together: "Liên hệ nâng cấp"
 * closes the plans modal and opens the form with the matching source.
 */
export function useSubscriptionDialogs(
	plan: PlanId,
	manageSource: ProInterestSource = "subscription_modal",
): SubscriptionDialogs {
	const [plans, setPlans] = useState<{ open: boolean; reason: LimitReason }>({
		open: false,
		reason: null,
	});
	const [interest, setInterest] = useState<{
		open: boolean;
		source: ProInterestSource;
	}>({ open: false, source: "subscription_modal" });

	const openPlans = useCallback((reason: LimitReason = null) => {
		setPlans({ open: true, reason });
	}, []);
	const openProInterest = useCallback((source: ProInterestSource) => {
		setInterest({ open: true, source });
	}, []);

	const element = (
		<>
			<ManageSubscriptionModal
				open={plans.open}
				onOpenChange={(open) => setPlans((current) => ({ ...current, open }))}
				plan={plan}
				reason={plans.reason}
				manageSource={manageSource}
				onContact={(source) => {
					setPlans((current) => ({ ...current, open: false }));
					openProInterest(source);
				}}
			/>
			<ProInterestModal
				open={interest.open}
				source={interest.source}
				onOpenChange={(open) =>
					setInterest((current) => ({ ...current, open }))
				}
			/>
		</>
	);

	return { openPlans, openProInterest, element };
}
