import type { ReactNode } from "react";
import { Alert } from "../../../components/ui/alert";
import { useT } from "../../../i18n/i18n-context";
import { isRecord } from "../../../lib/json-guards";
import type { SendFailure } from "../workbench/workbench-types";
import { describeFailure } from "./describe-failure";
import { ScriptConsole } from "./script-results";

export interface ResponseErrorProps {
	failure: SendFailure;
	actions?: ReactNode;
}

/**
 * A send that got no response: what happened, what to do next, and the
 * code (so a support question can name it). Never echoes request values.
 * The pre-request script's console follows when it logged, as it may say why.
 */
export function ResponseError({ failure, actions }: ResponseErrorProps) {
	const t = useT();
	const { title, hint } = describeFailure(failure, t);
	// `PROXY_CONNECTION_FAILED` names the Node error (`ECONNREFUSED`…).
	const cause = isRecord(failure.details) ? failure.details.cause : null;
	return (
		<div
			data-id="response-error"
			className="grid min-h-0 flex-1 content-start gap-3 overflow-auto p-4"
		>
			<Alert tone="danger" title={title}>
				<p className="m-0">{hint}</p>
				<p
					data-id="response-error-code"
					className="m-0 mt-1 font-mono text-muted text-xs"
				>
					{t("apiClientTools.errors.code", {
						code:
							typeof cause === "string"
								? `${failure.code} (${cause})`
								: failure.code,
					})}
				</p>
			</Alert>
			{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
			<ScriptConsole outcome={failure.preScript} />
		</div>
	);
}
