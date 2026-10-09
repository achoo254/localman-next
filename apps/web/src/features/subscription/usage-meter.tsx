import { IconAlertTriangle } from "@tabler/icons-react";
import { useId } from "react";
import { cardClassName } from "../../components/ui/card";
import { useI18n } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import type { UsageCounter } from "./account-usage-api";

/** From this share of the quota the meter turns to the warning colour. */
export const WARNING_RATIO = 0.8;

export interface UsageMeterProps {
	label: string;
	counter: UsageCounter;
	note: string;
	"data-id": string;
}

/** Quota gauge: used/max with a bar, or a plain count when uncapped. */
export function UsageMeter({
	label,
	counter,
	note,
	"data-id": dataId,
}: UsageMeterProps) {
	const { t, formatNumber } = useI18n();
	const labelId = useId();
	const { used, max } = counter;
	const percent =
		max === null || max <= 0
			? 0
			: Math.min(100, Math.round((used / max) * 100));
	const warn = max !== null && used >= max * WARNING_RATIO;

	return (
		<article
			data-id={dataId}
			data-state={warn ? "warning" : "ok"}
			className={cn(cardClassName, "grid content-start gap-2 p-6")}
		>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<span id={labelId} className="font-mono font-semibold text-sm">
					{label}
				</span>
				<span
					className={cn(
						"font-bold font-mono text-[0.9375rem]",
						warn && "text-warning",
					)}
				>
					{max === null
						? formatNumber(used)
						: `${formatNumber(used)}/${formatNumber(max)}`}
				</span>
			</div>
			{max === null ? (
				<p className="m-0 text-[0.8125rem] text-muted">
					{renderRich(t("subscription.usage.unlimited"), {
						b: (chunk) => <b className="text-fg">{chunk}</b>,
					})}
				</p>
			) : (
				<>
					<div
						role="meter"
						aria-labelledby={labelId}
						aria-valuemin={0}
						aria-valuemax={max}
						aria-valuenow={Math.min(used, max)}
						aria-valuetext={t("subscription.usage.valueText", { used, max })}
						className="h-2 overflow-hidden rounded-full bg-bar-track"
					>
						<span
							className={cn(
								"block h-full rounded-full transition-[width] duration-(--dur-slow)",
								warn ? "bg-warning" : "bg-primary",
							)}
							style={{ width: `${percent}%` }}
						/>
					</div>
					<p className="m-0 flex items-start gap-1 text-[0.8125rem] text-muted">
						{warn ? (
							<IconAlertTriangle
								size={16}
								aria-hidden="true"
								className="mt-0.5 text-warning"
							/>
						) : null}
						<span>
							{warn
								? `${
										percent >= 100
											? t("subscription.usage.reached")
											: t("subscription.usage.usedPercent", { percent })
									} `
								: null}
							{note}
						</span>
					</p>
				</>
			)}
		</article>
	);
}
