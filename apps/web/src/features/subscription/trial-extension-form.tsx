import {
	TRIAL_EXTENSION_DAYS,
	TRIAL_EXTENSION_REASON_MAX,
} from "@localman/shared/constants";
import { type FormEvent, useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { FormField } from "../../components/ui/form-field";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import { cn } from "../../lib/cn";
import { fetchCurrentUser } from "../auth/current-user";
import { setCurrentUser } from "../auth/use-current-user";
import {
	extensionErrorMessage,
	isTrialStateConflict,
	requestTrialExtension,
} from "./trial-api";
import { type TrialInfo, canRequestExtension } from "./trial-state";

/** The reason's problem as a message, or null when it can be sent. */
export function reasonError(reason: string, t: Translate): string | null {
	const length = reason.trim().length;
	if (length === 0) return t("trial.extension.reasonEmpty");
	if (length > TRIAL_EXTENSION_REASON_MAX) {
		return t("trial.extension.reasonTooLong", {
			max: TRIAL_EXTENSION_REASON_MAX,
		});
	}
	return null;
}

function RequestStatus({ trial }: { trial: TrialInfo }) {
	const { t, formatDate } = useI18n();
	const request = trial.extensionRequest;
	if (!request) return null;
	const date = formatDate(request.decidedAt ?? request.requestedAt);
	if (request.status === "pending") {
		return (
			<Alert data-id="account-trial-extension-status">
				{t("trial.extension.pending", {
					date: formatDate(request.requestedAt),
				})}
			</Alert>
		);
	}
	return request.status === "approved" ? (
		<Alert tone="success" data-id="account-trial-extension-status">
			{t("trial.extension.approved", { date })}
		</Alert>
	) : (
		<Alert data-id="account-trial-extension-status">
			{t("trial.extension.declined", { date })}
		</Alert>
	);
}

/**
 * Account page: ask the owner for more Pro time, during the trial or up to
 * a week after it, and see how the last request went.
 */
export function TrialExtensionForm({ trial }: { trial: TrialInfo }) {
	const { t } = useI18n();
	const toast = useToast();
	const headingId = useId();
	const [reason, setReason] = useState("");
	const [invalid, setInvalid] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const open = canRequestExtension(trial);
	if (!open && (trial.status === "available" || !trial.extensionRequest)) {
		return null;
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const problem = reasonError(reason, t);
		setInvalid(problem);
		setFailure(null);
		if (problem) return;
		setBusy(true);
		try {
			setCurrentUser(await requestTrialExtension(reason.trim()));
			setReason("");
			toast.show({ title: t("trial.extension.sent") });
		} catch (error) {
			setFailure(extensionErrorMessage(error, t));
			// A request already waits or the window closed: show the real state.
			// Best effort; the message above already explains the refusal.
			if (isTrialStateConflict(error)) {
				fetchCurrentUser().then(setCurrentUser, () => undefined);
			}
		} finally {
			setBusy(false);
		}
	}

	return (
		<section
			data-id="account-trial-extension"
			aria-labelledby={headingId}
			className={cn(cardClassName, "grid gap-4 p-6")}
		>
			<div className="grid gap-1">
				<h2 id={headingId} className="m-0 font-bold font-mono text-base">
					{t("trial.extension.title")}
				</h2>
				<p className="m-0 text-muted text-sm">
					{t("trial.extension.lead", { days: TRIAL_EXTENSION_DAYS })}
				</p>
			</div>
			<RequestStatus trial={trial} />
			{failure ? (
				<Alert tone="danger" data-id="account-trial-extension-error">
					{failure}
				</Alert>
			) : null}
			{open ? (
				<form
					noValidate
					onSubmit={(event) => void submit(event)}
					className="grid justify-items-start gap-3"
				>
					<FormField
						label={t("trial.extension.reason")}
						hint={t("trial.extension.reasonHint", {
							max: TRIAL_EXTENSION_REASON_MAX,
						})}
						error={invalid}
						required
						className="w-full"
						data-id="account-trial-extension-reason"
					>
						<Textarea
							value={reason}
							onChange={(event) => setReason(event.target.value)}
						/>
					</FormField>
					<Button
						type="submit"
						variant="primary"
						loading={busy}
						data-id="account-trial-extension-submit"
					>
						{t("trial.extension.submit")}
					</Button>
				</form>
			) : null}
		</section>
	);
}
