import type { PlanLimits } from "@localman/shared";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cardClassName } from "../../components/ui/card";
import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/format";

function monthly(limit: number | null, unit: string): string {
	return limit === null
		? `Không giới hạn ${unit} mỗi tháng`
		: `${formatNumber(limit)} ${unit} mỗi tháng`;
}

/** What a plan includes, in the order the prototype lists it. */
export function planItems(limits: PlanLimits): Array<[boolean, string]> {
	return [
		[true, `${limits.projects} project`],
		[true, `${limits.resources} resource mỗi project`],
		[
			limits.customResponse && limits.objectTemplate,
			"Custom response và object template",
		],
		[true, `Tối đa ${limits.membersPerWorkspace} thành viên, tính cả bạn`],
		[true, monthly(limits.mockRequestsPerMonth, "request tới mock")],
		[true, monthly(limits.proxyRequestsPerMonth, "request qua proxy")],
	];
}

export interface PlanCardProps {
	name: string;
	limits: PlanLimits;
	featured?: boolean;
	badge?: ReactNode;
	/** Short line under the name (price or pitch). */
	lead?: ReactNode;
	action?: ReactNode;
	"data-id": string;
}

/** One plan with its limits; used by the plans modal and the landing. */
export function PlanCard({
	name,
	limits,
	featured = false,
	badge,
	lead,
	action,
	"data-id": dataId,
}: PlanCardProps) {
	return (
		<article
			data-id={dataId}
			className={cn(
				// The featured card swaps the neutral border for the primary ring.
				featured
					? "rounded-xl border border-primary bg-surface shadow-md outline outline-primary"
					: cardClassName,
				"flex flex-col gap-4 p-6 text-left",
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<h3 className="m-0 font-bold font-mono text-base">{name}</h3>
				{badge}
			</div>
			{lead ? <p className="m-0 text-muted text-sm">{lead}</p> : null}
			<ul className="m-0 grid list-none gap-2 p-0 text-[0.8125rem]">
				{planItems(limits).map(([included, label]) => (
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
							{included ? null : <span className="sr-only">Không có: </span>}
							{label}
						</span>
					</li>
				))}
			</ul>
			{action ? <div className="mt-auto">{action}</div> : null}
		</article>
	);
}
