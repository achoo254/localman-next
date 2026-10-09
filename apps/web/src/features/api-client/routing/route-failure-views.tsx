import { IconLock, IconPlugConnected, IconTransfer } from "@tabler/icons-react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";
import type { RouteFailure } from "../workbench/workbench-types";

const VIEW = "grid min-h-0 flex-1 content-start gap-3 overflow-auto p-4";

export interface DirectFailViewProps {
	failure: Extract<RouteFailure, { kind: "direct" }>;
	/** Show "Use Auto" (the tab is set to Direct). */
	canUseAuto: boolean;
	/** Sends again through the proxy (or a local target's tunnel). */
	onProxy: () => void;
	onUseAuto: () => void;
}

/** A direct send that got nothing, with the ways to send it anyway. */
export function DirectFailView({
	failure,
	canUseAuto,
	onProxy,
	onUseAuto,
}: DirectFailViewProps) {
	const t = useT();
	const { host, reason, local } = failure;
	return (
		<div data-id="response-direct-fail" className={VIEW}>
			<Alert
				tone="danger"
				title={t(`apiClientRouting.direct.title.${reason}`, { host })}
			>
				<p className="m-0">
					{t(`apiClientRouting.failure.${reason}`, { host })}
				</p>
			</Alert>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="primary"
					data-id="response-direct-fail-proxy"
					onClick={onProxy}
				>
					{local ? (
						<IconPlugConnected size={16} aria-hidden="true" />
					) : (
						<IconTransfer size={16} aria-hidden="true" />
					)}
					{local
						? t("apiClientRouting.direct.tryTunelo")
						: t("apiClientRouting.direct.sendProxy")}
				</Button>
				{canUseAuto ? (
					<Button data-id="response-direct-fail-auto" onClick={onUseAuto}>
						{t("apiClientRouting.direct.useAuto")}
					</Button>
				) : null}
			</div>
		</div>
	);
}

export interface ConsentBlockedViewProps {
	parts: readonly string[];
	/** Sends again, which asks again. */
	onAsk: () => void;
}

/** The user declined to let credentials through the proxy: nothing sent. */
export function ConsentBlockedView({ parts, onAsk }: ConsentBlockedViewProps) {
	const t = useT();
	return (
		<div data-id="response-route-consent" className={VIEW}>
			<Alert tone="info" title={t("apiClientRouting.consent.blockedTitle")}>
				<p className="m-0">
					{t("apiClientRouting.consent.blockedBody", {
						parts: parts.join(", "),
					})}
				</p>
			</Alert>
			<div>
				<Button
					variant="primary"
					data-id="response-route-consent-open"
					onClick={onAsk}
				>
					<IconLock size={16} aria-hidden="true" />
					{t("apiClientRouting.consent.reopen")}
				</Button>
			</div>
		</div>
	);
}
