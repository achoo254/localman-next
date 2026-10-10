import type { ReactNode } from "react";
import { Badge } from "../../components/ui/badge";
import { useI18n } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { logTime } from "../request-log/request-log-row";
import { type Delivery, MAX_ATTEMPTS } from "./delivery";
import { DeliveryAttempts } from "./delivery-attempts";
import type { CallbackTestState } from "./use-callback-test";

const LINE = "m-0 flex flex-wrap items-center gap-2 text-sm";

/** "[200] 84 ms after 1/3 attempts", then each attempt when it failed. */
function DeliveryLine({
	lead,
	delivery,
	dataId,
}: {
	lead: ReactNode;
	delivery: Delivery;
	dataId: string;
}) {
	const { t } = useI18n();
	return (
		<div
			className="grid gap-1"
			data-id={dataId}
			data-state={delivery.ok ? "ok" : "failed"}
		>
			<p className={LINE}>
				<span className="wrap-anywhere">{lead}</span>
				{delivery.status === null ? null : (
					<Badge tone={delivery.ok ? "success" : "danger"}>
						{delivery.status}
					</Badge>
				)}
				<span className="font-mono text-muted">
					{t("mockCallbacks.last.attempts", {
						ms: delivery.ms,
						n: String(delivery.attempts.length),
						max: String(MAX_ATTEMPTS),
					})}
				</span>
			</p>
			{delivery.ok ? null : (
				<DeliveryAttempts
					attempts={delivery.attempts}
					dataIdPrefix={`${dataId}-attempt`}
				/>
			)}
		</div>
	);
}

export interface CallbackResultProps {
	last: Delivery | null;
	test: CallbackTestState;
}

/**
 * Live region under a callback: the result of "Send test" when one ran,
 * and how the last real delivery ended.
 */
export function CallbackResult({ last, test }: CallbackResultProps) {
	const { t, formatDate } = useI18n();
	return (
		<div aria-live="polite" className="grid gap-2">
			{test.status === "done" ? (
				<div className="grid gap-2">
					<DeliveryLine
						lead={renderRich(
							t("mockCallbacks.test.result", { target: test.result.target }),
						)}
						delivery={test.result.delivery}
						dataId="resource-form-callback-test-result"
					/>
					{test.result.response?.body ? (
						<div className="grid gap-1">
							<span className="font-mono font-semibold text-[0.8125rem]">
								{t("mockCallbacks.test.response")}
							</span>
							<pre
								// biome-ignore lint/a11y/noNoninteractiveTabindex: a long answer scrolls; keyboard users need focus to scroll it.
								tabIndex={0}
								className="m-0 max-h-40 overflow-auto rounded-md border border-border-subtle bg-surface-subtle p-2 font-mono text-xs"
							>
								{test.result.response.body}
							</pre>
							{test.result.response.truncated ? (
								<span className="text-muted text-xs">
									{t("mockCallbacks.test.truncated")}
								</span>
							) : null}
						</div>
					) : null}
				</div>
			) : null}
			{test.status === "error" ? (
				<p
					className="m-0 text-error text-sm"
					data-id="resource-form-callback-test-error"
				>
					{test.message}
				</p>
			) : null}
			{last ? (
				<DeliveryLine
					lead={t("mockCallbacks.last.sent", {
						time: `${formatDate(last.at)} ${logTime(last.at)}`,
					})}
					delivery={last}
					dataId="resource-form-callback-last"
				/>
			) : (
				<p
					className="m-0 text-muted text-sm"
					data-id="resource-form-callback-last"
				>
					{t("mockCallbacks.last.never")}
				</p>
			)}
		</div>
	);
}
