import {
	type ContactSource,
	TURNSTILE_ACTIONS,
} from "@localman/shared/constants";
import {
	type FormEvent,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { TurnstileSkeleton } from "../subscription/form-skeleton";
import { TurnstileField } from "../subscription/turnstile-field";
import {
	SESSION_LOST,
	type SubmitProblem,
	isTurnstileRefusal,
	submitFeedback,
	submitProblem,
	validationDetails,
} from "./feedback-api";
import {
	type FeedbackDraft,
	type FeedbackErrors,
	emptyDraft,
	fieldErrorsFromDetails,
	toFeedbackBody,
	validateFeedback,
} from "./feedback-draft";
import { FeedbackFields, feedbackErrorText } from "./feedback-fields";
import { useTurnstileConfig } from "./use-turnstile-config";

export interface FeedbackAccount {
	name: string | null;
	email: string | null;
}

export interface FeedbackFormBodyProps {
	/** Lets the submit button in the modal footer target the form. */
	formId: string;
	firstFieldRef: RefObject<HTMLTextAreaElement | null>;
	source: ContactSource;
	/**
	 * Signed-in user (name and email are prefilled, Turnstile is skipped and
	 * the API links the message to them); null for a visitor.
	 */
	account: FeedbackAccount | null;
	onBusyChange: (busy: boolean) => void;
	/** Receives the reply address that was sent, or null. */
	onSubmitted: (contact: string | null) => void;
	/** The API saw no session although `account` is set: read it again. */
	onSessionLost: () => void;
}

/** Form state, Turnstile for visitors, and the request. */
export function FeedbackFormBody({
	formId,
	firstFieldRef,
	source,
	account,
	onBusyChange,
	onSubmitted,
	onSessionLost,
}: FeedbackFormBodyProps) {
	const t = useT();
	const signedIn = account !== null;
	const [draft, setDraft] = useState<FeedbackDraft>(() => emptyDraft(account));
	const [errors, setErrors] = useState<FeedbackErrors>({});
	const { state: config, retry: retryConfig } = useTurnstileConfig(signedIn);
	const [token, setToken] = useState<string | null>(null);
	const [widgetKey, setWidgetKey] = useState(0);
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState<SubmitProblem | null>(null);
	const form = useRef<HTMLFormElement>(null);
	const focusInvalid = useRef(false);

	useEffect(() => {
		firstFieldRef.current?.focus();
	}, [firstFieldRef]);

	// After a failed check, move focus to the first field that needs fixing.
	useEffect(() => {
		if (!focusInvalid.current) return;
		focusInvalid.current = false;
		form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	});

	const siteKey =
		config.status === "ready" ? config.config.turnstileSiteKey : null;

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (busy || config.status !== "ready") return;
		const found = validateFeedback(draft, siteKey !== null, token);
		setErrors(found);
		if (Object.keys(found).length > 0) {
			focusInvalid.current = true;
			return;
		}
		setBusy(true);
		onBusyChange(true);
		setProblem(null);
		try {
			await submitFeedback(toFeedbackBody(draft, source, token));
			onSubmitted(draft.contact.trim() || null);
		} catch (error) {
			const sessionLost = signedIn && isTurnstileRefusal(error);
			setProblem(sessionLost ? SESSION_LOST : submitProblem(error));
			if (sessionLost) onSessionLost();
			const fields = fieldErrorsFromDetails(validationDetails(error));
			if (Object.keys(fields).length > 0) {
				setErrors(fields);
				focusInvalid.current = true;
			}
			// Turnstile tokens are single use: get a fresh one for the retry.
			if (siteKey) {
				setToken(null);
				setWidgetKey((key) => key + 1);
			}
		} finally {
			setBusy(false);
			onBusyChange(false);
		}
	}

	if (config.status === "error") {
		return (
			<div className="grid justify-items-start gap-3">
				<Alert tone="danger" title={t("feedback.openFailed")}>
					{errorMessage(config.error)}
				</Alert>
				<Button data-id="modal-feedback-retry" onClick={retryConfig}>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	}

	return (
		<form
			id={formId}
			ref={form}
			noValidate
			onSubmit={submit}
			data-id="modal-feedback-form"
			data-source={source}
			className="grid gap-4"
		>
			<fieldset disabled={busy} className="m-0 grid min-w-0 gap-4 border-0 p-0">
				<FeedbackFields
					draft={draft}
					errors={errors}
					firstFieldRef={firstFieldRef}
					prefilled={{
						name: Boolean(account?.name),
						contact: Boolean(account?.email),
					}}
					onChange={(patch) =>
						setDraft((current) => ({ ...current, ...patch }))
					}
				/>
			</fieldset>
			{siteKey ? (
				<TurnstileField
					key={widgetKey}
					siteKey={siteKey}
					onTokenChange={setToken}
					action={TURNSTILE_ACTIONS.contact}
					dataId="modal-feedback-turnstile"
					error={feedbackErrorText(t, errors.turnstile)}
					errorId={`${formId}-turnstile-error`}
				/>
			) : null}
			{config.status === "loading" ? (
				<TurnstileSkeleton
					data-id="modal-feedback-turnstile-loading"
					label={t("feedback.preparing")}
				/>
			) : null}
			<p className="m-0 text-[0.8125rem] text-muted">
				{signedIn ? t("feedback.noteSignedIn") : t("feedback.noteVisitor")}
			</p>
			{problem ? (
				<Alert tone={problem.tone} data-id="modal-feedback-error">
					{t(`feedback.submit.${problem.key}`)}
				</Alert>
			) : null}
		</form>
	);
}
