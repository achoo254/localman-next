import { useState } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { ApiError, errorMessage } from "../../lib/api-client";
import type { CallbackDraft } from "./callback-draft";
import {
	type CallbackErrors,
	checkDraft,
	serverErrors,
} from "./callback-validation";
import { type CallbackTestResult, testCallback } from "./callbacks-api";

export type CallbackTestState =
	| { status: "idle" }
	| { status: "sending" }
	| { status: "done"; result: CallbackTestResult }
	| { status: "error"; message: string };

/**
 * "Send test" of one callback: the current draft (saved or not) sent now
 * with the resource's first record. Draft errors go to `onErrors`.
 */
export function useCallbackTest(
	projectId: string,
	resourceId: string,
	onErrors: (errors: CallbackErrors) => void,
) {
	const t = useT();
	const toast = useToast();
	const [state, setState] = useState<CallbackTestState>({ status: "idle" });

	async function run(draft: CallbackDraft) {
		if (state.status === "sending") return;
		const checked = checkDraft(draft, t);
		if (checked.input === null) {
			onErrors(checked.errors);
			return;
		}
		setState({ status: "sending" });
		try {
			const result = await testCallback(projectId, resourceId, checked.input);
			setState({ status: "done", result });
			const { delivery, target } = result;
			toast.show({
				tone: delivery.ok ? "success" : "error",
				title: renderRich(
					delivery.ok
						? t("mockCallbacks.test.sent", { target })
						: t("mockCallbacks.test.failed", {
								target,
								count: delivery.attempts.length,
							}),
				),
			});
		} catch (error) {
			const placed = serverErrors(error, [], t, draft);
			const own = placed?.[draft.key];
			if (own) {
				setState({ status: "idle" });
				onErrors(own);
				return;
			}
			const busy = error instanceof ApiError && error.code === "PROXY_BUSY";
			setState({
				status: "error",
				message: busy ? t("mockCallbacks.test.busy") : errorMessage(error),
			});
		}
	}

	return { state, run };
}
