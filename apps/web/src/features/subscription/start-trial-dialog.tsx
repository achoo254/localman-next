import { TRIAL_DAYS } from "@localman/shared/constants";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/i18n-context";
import { fetchCurrentUser } from "../auth/current-user";
import { setCurrentUser } from "../auth/use-current-user";
import {
	isTrialStateConflict,
	startTrial,
	trialErrorMessage,
} from "./trial-api";
import { trialEndPreview } from "./trial-state";

export interface StartTrialDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Confirms the one-time Pro trial, then starts it. On success the cached
 * `me` takes the server's answer, so every plan badge and limit follows.
 */
export function StartTrialDialog({
	open,
	onOpenChange,
}: StartTrialDialogProps) {
	const { t, formatDate } = useI18n();
	const toast = useToast();
	const submit = useRef<HTMLButtonElement>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function changeOpen(next: boolean) {
		if (busy) return;
		if (!next) setError(null);
		onOpenChange(next);
	}

	async function confirm() {
		setBusy(true);
		setError(null);
		try {
			const user = await startTrial();
			setCurrentUser(user);
			toast.show({
				title: t("trial.started", {
					date: formatDate(user.trial.endsAt ?? trialEndPreview()),
				}),
			});
			onOpenChange(false);
		} catch (cause) {
			setError(trialErrorMessage(cause, t));
			// The trial was used or Pro granted elsewhere: let the page catch
			// up. Best effort; the message above already explains the refusal.
			if (isTrialStateConflict(cause)) {
				fetchCurrentUser().then(setCurrentUser, () => undefined);
			}
		} finally {
			setBusy(false);
		}
	}

	return (
		<Modal
			open={open}
			onOpenChange={changeOpen}
			title={t("trial.confirm.title")}
			size="sm"
			initialFocusRef={submit}
			data-id="modal-start-trial"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={busy}>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						ref={submit}
						variant="primary"
						loading={busy}
						onClick={() => void confirm()}
						data-id="modal-start-trial-confirm"
					>
						{t("trial.confirm.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<div className="grid gap-2 text-sm">
				<strong className="font-mono">
					{t("trial.confirm.question", {
						days: TRIAL_DAYS,
						date: formatDate(trialEndPreview()),
					})}
				</strong>
				<ul className="m-0 grid list-disc gap-1 pl-5 text-muted">
					<li>{t("trial.confirm.once")}</li>
					<li>{t("trial.confirm.after")}</li>
				</ul>
			</div>
			{error ? (
				<Alert tone="danger" data-id="modal-start-trial-error">
					{error}
				</Alert>
			) : null}
		</Modal>
	);
}

export interface StartTrialControl {
	/** Opens the confirmation. */
	open: () => void;
	/** Render once where the control is used. */
	element: ReactNode;
}

/** The confirmation's open state, for screens with a "Start trial" button. */
export function useStartTrial(): StartTrialControl {
	const [open, setOpen] = useState(false);
	// Mounted from the first opening on (and kept for the closing animation),
	// so screens that never offer the trial pay nothing for it.
	const [opened, setOpened] = useState(false);
	const openConfirm = useCallback(() => {
		setOpened(true);
		setOpen(true);
	}, []);
	return {
		open: openConfirm,
		element: opened ? (
			<StartTrialDialog open={open} onOpenChange={setOpen} />
		) : null,
	};
}
