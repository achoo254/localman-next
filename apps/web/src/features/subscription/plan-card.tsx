import type { PlanLimits } from "@localman/shared/constants";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cardClassName } from "../../components/ui/card";
import { type FeatureFlags, useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import { cn } from "../../lib/cn";

/**
 * What a plan includes, in the order the prototype lists it. Items of a
 * feature that is not in production yet (proxy before the API client) are
 * left out instead of being announced early.
 */
export function planItems(
	limits: PlanLimits,
	flags: FeatureFlags,
	t: Translate,
): Array<[boolean, string]> {
	const mock = limits.mockRequestsPerMonth;
	const items: Array<[boolean, string]> = [
		[true, t("subscription.plan.projects", { count: limits.projects })],
		[true, t("subscription.plan.resources", { count: limits.resources })],
		[
			limits.customResponse && limits.objectTemplate,
			t("subscription.plan.customResponse"),
		],
		[
			true,
			t("subscription.plan.members", { count: limits.membersPerWorkspace }),
		],
		[
			true,
			mock === null
				? t("subscription.plan.mockRequestsUnlimited")
				: t("subscription.plan.mockRequests", { count: mock }),
		],
	];
	if (flags.apiClient) {
		const proxy = limits.proxyRequestsPerMonth;
		items.push([
			true,
			proxy === null
				? t("subscription.plan.proxyRequestsUnlimited")
				: t("subscription.plan.proxyRequests", { count: proxy }),
		]);
	}
	return items;
}

export type PlanCardSize = "md" | "sm";

const SIZE: Record<PlanCardSize, { card: string; list: string }> = {
	md: { card: "gap-4 p-6", list: "text-sm" },
	sm: { card: "gap-3 p-4", list: "text-[0.8125rem]" },
};

export interface PlanCardProps {
	name: string;
	limits: PlanLimits;
	featured?: boolean;
	badge?: ReactNode;
	/** Large price line under the name ("Free"). */
	price?: ReactNode;
	/** Short pitch under the name or price. */
	lead?: ReactNode;
	action?: ReactNode;
	/** `md` on the landing, `sm` in the plans modal. */
	size?: PlanCardSize;
	"data-id": string;
}

/** One plan with its limits; used by the plans modal and the landing. */
export function PlanCard({
	name,
	limits,
	featured = false,
	badge,
	price,
	lead,
	action,
	size = "sm",
	"data-id": dataId,
}: PlanCardProps) {
	const flags = useFeatures();
	const t = useT();
	return (
		<article
			data-id={dataId}
			className={cn(
				// The featured card swaps the neutral border for the primary ring.
				featured
					? "rounded-xl border border-primary bg-surface shadow-md outline outline-primary"
					: cardClassName,
				"flex flex-col text-left",
				SIZE[size].card,
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<h3 className="m-0 font-bold font-mono text-base">{name}</h3>
				{badge}
			</div>
			{price ? (
				<p
					data-id={`${dataId}-price`}
					className="m-0 font-bold font-mono text-4xl leading-none"
				>
					{price}
				</p>
			) : null}
			{lead ? <p className="m-0 text-muted text-sm">{lead}</p> : null}
			<ul className={cn("m-0 grid list-none gap-2 p-0", SIZE[size].list)}>
				{planItems(limits, flags, t).map(([included, label]) => (
					<li
						key={label}
						className={cn(
							"flex items-start gap-2",
							included ? "text-fg" : "text-muted",
						)}
					>
						{included ? (
							<IconCheck
								size={18}
								aria-hidden="true"
								className="text-primary"
							/>
						) : (
							<IconX size={18} aria-hidden="true" className="text-icon-muted" />
						)}
						<span>
							{included ? null : (
								<span className="sr-only">
									{`${t("subscription.plan.notIncluded")} `}
								</span>
							)}
							{label}
						</span>
					</li>
				))}
			</ul>
			{action ? <div className="mt-auto">{action}</div> : null}
		</article>
	);
}
