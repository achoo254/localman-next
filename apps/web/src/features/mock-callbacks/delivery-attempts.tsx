import { Badge } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import {
	type DeliveryAttempt,
	type DeliveryError,
	MAX_ATTEMPTS,
} from "./delivery";

/** Plain-language reason of an attempt that got no answer. */
export function deliveryErrorText(t: Translate, error: DeliveryError): string {
	switch (error) {
		case "no_tunnel":
			return t("mockCallbacks.delivery.errors.noTunnel");
		case "connect":
			return t("mockCallbacks.delivery.errors.connect");
		case "timeout":
			return t("mockCallbacks.delivery.errors.timeout");
		case "dns":
			return t("mockCallbacks.delivery.errors.dns");
		case "blocked":
			return t("mockCallbacks.delivery.errors.blocked");
		case "body_too_large":
			return t("mockCallbacks.delivery.errors.bodyTooLarge");
		case "invalid_target":
			return t("mockCallbacks.delivery.errors.invalidTarget");
		case "queue_full":
			return t("mockCallbacks.delivery.errors.queueFull");
		case "quota_exceeded":
			return t("mockCallbacks.delivery.errors.quotaExceeded");
		case "expired":
			return t("mockCallbacks.delivery.errors.expired");
	}
}

export interface DeliveryAttemptsProps {
	attempts: readonly DeliveryAttempt[];
	/** Each item is `{prefix}-{n}`. */
	dataIdPrefix: string;
}

/** "Attempt n/3", the answer's status, the time and why it failed. */
export function DeliveryAttempts({
	attempts,
	dataIdPrefix,
}: DeliveryAttemptsProps) {
	const t = useT();
	const max = String(MAX_ATTEMPTS);
	return (
		<ol
			aria-label={t("mockCallbacks.delivery.attempts", { max })}
			className="m-0 grid list-none gap-1 p-0"
		>
			{attempts.map((attempt, index) => (
				<li
					key={`${attempt.at}-${index}`}
					data-id={`${dataIdPrefix}-${index + 1}`}
					className="flex flex-wrap items-center gap-2 text-sm"
				>
					<span>
						{t("mockCallbacks.delivery.attempt", { n: String(index + 1), max })}
					</span>
					{attempt.status === null ? null : (
						<Badge tone={attempt.status < 400 ? "success" : "danger"}>
							{attempt.status}
						</Badge>
					)}
					<span className="font-mono text-muted">
						{t("mockCallbacks.delivery.ms", { ms: attempt.ms })}
					</span>
					{attempt.error ? (
						<span className="text-muted wrap-anywhere">
							{deliveryErrorText(t, attempt.error)}
						</span>
					) : attempt.status !== null && attempt.status >= 400 ? (
						<span className="text-muted">
							{t("mockCallbacks.delivery.answered", {
								status: String(attempt.status),
							})}
						</span>
					) : null}
				</li>
			))}
		</ol>
	);
}
