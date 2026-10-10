import type { ElementRole } from "@localman/shared/access";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import {
	type AccessRequest,
	approveAccessRequest,
	denyAccessRequest,
} from "./access-requests-api";
import { errorCodeOf, sharingErrorMessage } from "./sharing-errors";

export type Resolution =
	| { action: "approve"; requestId: string; role: ElementRole }
	| { action: "deny"; requestId: string };

export function requesterName(request: AccessRequest, t: Translate): string {
	const { name, username } = request.requester;
	if (name) return name;
	return username ? `@${username}` : t("sharing.requestPage.deletedAccount");
}

/**
 * Approve (with the role the approver saw) or deny an access request. A
 * refusal that means the request moved on (403, 404, 409 such as
 * `REQUEST_CHANGED` or `ALREADY_RESOLVED`) is shown as a toast and
 * `onStale` runs so the caller loads the request again.
 */
export function useResolveAccessRequest({
	onResolved,
	onStale,
	changedMessage,
}: {
	onResolved?: (request: AccessRequest) => void;
	onStale: () => void;
	/** Replaces the `REQUEST_CHANGED` message (the bell names what to do). */
	changedMessage?: string;
}) {
	const t = useT();
	const toast = useToast();
	return useMutation({
		mutationFn: (input: Resolution) =>
			input.action === "approve"
				? approveAccessRequest(input.requestId, input.role)
				: denyAccessRequest(input.requestId),
		onSuccess: (request, input) => {
			const name = requesterName(request, t);
			toast.show({
				tone: "success",
				title:
					input.action === "approve"
						? t("sharing.requestPage.approvedToast", { name })
						: t("sharing.requestPage.deniedToast", { name }),
			});
			onResolved?.(request);
		},
		onError: (error) => {
			const changed = errorCodeOf(error) === "REQUEST_CHANGED";
			toast.show({
				tone: "error",
				title:
					changed && changedMessage
						? changedMessage
						: sharingErrorMessage(error, t),
			});
			if (
				error instanceof ApiError &&
				(error.status === 403 || error.status === 404 || error.status === 409)
			) {
				onStale();
			}
		},
	});
}
