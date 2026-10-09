import type { ReactNode } from "react";
import { useT } from "../../../i18n/i18n-context";
import type { TabResponse } from "../workbench/workbench-types";
import { ResponseError } from "./response-error";
import { ResponseResult } from "./response-result";
import {
	ResponseCancelled,
	ResponseEmpty,
	ResponseSending,
} from "./response-status-views";

export interface ResponsePanelProps {
	/** The active tab's response (`WorkbenchTab.response`). */
	response: TabResponse;
	/** Cancels the send in flight; the Cancel button shows only when set. */
	onCancel?: () => void;
	/** Replaces the default route badge (e.g. one with a "why" tooltip). */
	routeBadge?: ReactNode;
	/** Shown between the meta row and the tabs (route note, tunnel warning). */
	banner?: ReactNode;
	/** Extra line under the empty state (e.g. the Auto route order). */
	emptyNote?: ReactNode;
	/** Buttons under an error (send through the proxy, see plans…). */
	errorActions?: ReactNode;
}

/**
 * Response area of a request tab: empty, sending (with Cancel), cancelled,
 * failed (code and next step) or the response with its meta and tabs.
 */
export function ResponsePanel({
	response,
	onCancel,
	routeBadge,
	banner,
	emptyNote,
	errorActions,
}: ResponsePanelProps) {
	const t = useT();
	return (
		<section
			data-id="response"
			aria-label={t("apiClientTools.response.label")}
			aria-busy={response.kind === "sending"}
			className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface"
		>
			{response.kind === "idle" ? <ResponseEmpty note={emptyNote} /> : null}
			{response.kind === "sending" ? (
				<ResponseSending onCancel={onCancel} />
			) : null}
			{response.kind === "cancelled" ? <ResponseCancelled /> : null}
			{response.kind === "failed" ? (
				<ResponseError failure={response.failure} actions={errorActions} />
			) : null}
			{response.kind === "done" ? (
				<ResponseResult
					result={response.result}
					routeBadge={routeBadge}
					banner={banner}
				/>
			) : null}
		</section>
	);
}
