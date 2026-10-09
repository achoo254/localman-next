import type { RouteMode } from "@localman/shared/api-client";
import { memo } from "react";
import { ResponsePanel } from "../response/response-panel";
import { TuneloPanel } from "../tunelo/tunelo-panel";
import { useWorkbenchActions } from "../workbench/workbench-context";
import type { SendResult, TabResponse } from "../workbench/workbench-types";
import { QuotaPlansAction } from "./quota-plans-action";
import { RouteBadge } from "./route-badge";
import { ConsentBlockedView, DirectFailView } from "./route-failure-views";
import { RouteNote } from "./route-note";

export interface RoutedResponsePanelProps {
	tabId: string;
	response: TabResponse;
	/** The tab's route, for "Use Auto". */
	route: RouteMode;
}

function hasRouteNote({ routing }: SendResult): boolean {
	return routing?.why === "cors" || (routing?.dropped.length ?? 0) > 0;
}

/**
 * The response area with the router's parts: route badge with its
 * reason, a note when the router switched on its own, and in place of an
 * error the next step (send through the proxy, open a tunnel, agree to
 * send credentials, see plans). Memoized on the tab's response: typing in
 * the request does not re-render a large response.
 */
export const RoutedResponsePanel = memo(function RoutedResponsePanel({
	tabId,
	response,
	route,
}: RoutedResponsePanelProps) {
	const workbench = useWorkbenchActions();
	const routing = response.kind === "failed" ? response.failure.routing : null;

	if (routing?.kind === "tunnel") {
		return (
			<TuneloPanel
				targetKey={routing.key}
				port={routing.port}
				directFailed={routing.directFailed}
				onResend={() => workbench.send(tabId)}
			/>
		);
	}
	if (routing?.kind === "direct") {
		return (
			<DirectFailView
				failure={routing}
				canUseAuto={route !== "auto"}
				onProxy={() =>
					workbench.send(tabId, {
						route: "proxy",
						afterDirectBlocked:
							routing.reason === "blocked" || routing.reason === "notRetried",
					})
				}
				onUseAuto={() => {
					workbench.updateDraft(tabId, (draft) => ({
						...draft,
						settings: { ...draft.settings, route: "auto" },
					}));
					workbench.send(tabId, { route: "auto" });
				}}
			/>
		);
	}
	if (routing?.kind === "consent") {
		return (
			<ConsentBlockedView
				parts={routing.parts}
				onAsk={() => workbench.send(tabId)}
			/>
		);
	}

	const result = response.kind === "done" ? response.result : null;
	const quota =
		response.kind === "failed" &&
		response.failure.code === "MONTHLY_QUOTA_EXCEEDED";
	return (
		<ResponsePanel
			response={response}
			onCancel={() => workbench.cancelSend(tabId)}
			routeBadge={
				result?.routing ? (
					<RouteBadge route={result.route} routing={result.routing} />
				) : undefined
			}
			banner={
				result && hasRouteNote(result) ? (
					<RouteNote result={result} />
				) : undefined
			}
			errorActions={quota ? <QuotaPlansAction /> : undefined}
		/>
	);
});
