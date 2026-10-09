import {
	type FormEvent,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";
import { Alert } from "../../components/ui/alert";
import { useFeatures } from "../../config/features";
import { errorMessage } from "../../lib/api-client";
import {
	type ProInterestConfig,
	fetchProInterestConfig,
	submitErrorMessage,
	submitProInterest,
} from "./pro-interest-api";
import { ProInterestFields } from "./pro-interest-fields";
import { type ProInterestSource, sourceNeedFor } from "./pro-interest-options";
import {
	type ProInterestDraft,
	type ProInterestErrors,
	emptyDraft,
	toSubmission,
	validateProInterest,
} from "./pro-interest-validation";
import { TurnstileField } from "./turnstile-field";

type ConfigState =
	| { status: "loading" }
	| { status: "ready"; config: ProInterestConfig }
	| { status: "error"; error: unknown };

export interface ProInterestFormProps {
	/** Lets a submit button outside the form (modal footer) target it. */
	formId: string;
	/**
	 * Receives the first field to fill: Email for visitors, Tên for signed-in
	 * users whose email is prefilled. Focused on mount.
	 */
	firstFieldRef: RefObject<HTMLInputElement | null>;
	source: ProInterestSource;
	/** Email of the signed-in user, prefilled and editable; null for visitors. */
	accountEmail: string | null;
	signedIn: boolean;
	onBusyChange: (busy: boolean) => void;
	onSubmitted: (email: string) => void;
}

const NO_CHECK: ConfigState = {
	status: "ready",
	config: { turnstileSiteKey: null },
};

/** Collects interest in the Pro plan; visitors also pass Turnstile. */
export function ProInterestForm({
	formId,
	firstFieldRef,
	source,
	accountEmail,
	signedIn,
	onBusyChange,
	onSubmitted,
}: ProInterestFormProps) {
	const flags = useFeatures();
	const [draft, setDraft] = useState<ProInterestDraft>(() =>
		emptyDraft(accountEmail ?? "", sourceNeedFor(source, flags)),
	);
	const [errors, setErrors] = useState<ProInterestErrors>({});
	const [config, setConfig] = useState<ConfigState>(
		signedIn ? NO_CHECK : { status: "loading" },
	);
	const [token, setToken] = useState<string | null>(null);
	const [widgetKey, setWidgetKey] = useState(0);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const busy = useRef(false);
	const form = useRef<HTMLFormElement>(null);
	const focusInvalid = useRef(false);

	useEffect(() => {
		if (signedIn) return;
		let active = true;
		fetchProInterestConfig().then(
			(value) => active && setConfig({ status: "ready", config: value }),
			(error: unknown) => active && setConfig({ status: "error", error }),
		);
		return () => {
			active = false;
		};
	}, [signedIn]);

	// The form may load after the modal opened (lazy chunk): focus here too.
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

	function update(patch: Partial<ProInterestDraft>) {
		setDraft((current) => ({ ...current, ...patch }));
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (busy.current || config.status !== "ready") return;
		const body = toSubmission(draft, source, token);
		const result = validateProInterest(body, siteKey !== null);
		setErrors(result.errors);
		if (!result.submission) {
			focusInvalid.current = true;
			return;
		}
		busy.current = true;
		onBusyChange(true);
		setSubmitError(null);
		try {
			await submitProInterest(result.submission);
			onSubmitted(draft.email.trim());
		} catch (error) {
			setSubmitError(submitErrorMessage(error));
			// Turnstile tokens are single use: get a fresh one for the retry.
			if (siteKey) {
				setToken(null);
				setWidgetKey((key) => key + 1);
			}
		} finally {
			busy.current = false;
			onBusyChange(false);
		}
	}

	if (config.status === "error") {
		return (
			<Alert tone="danger" title="Không mở được form">
				{errorMessage(config.error)}
			</Alert>
		);
	}

	return (
		<form
			id={formId}
			ref={form}
			noValidate
			onSubmit={submit}
			data-id="pro-interest-form"
			data-source={source}
			className="grid gap-4"
		>
			<p className="m-0 text-muted text-sm">
				Gói Pro chưa mở thanh toán. Cho chúng tôi biết bạn cần gì, chúng tôi sẽ
				liên hệ khi gói Pro sẵn sàng.
			</p>
			<ProInterestFields
				draft={draft}
				errors={errors}
				prefilled={accountEmail !== null}
				firstFieldRef={firstFieldRef}
				firstField={signedIn ? "name" : "email"}
				onChange={update}
			/>
			{siteKey ? (
				<TurnstileField
					key={widgetKey}
					siteKey={siteKey}
					onTokenChange={setToken}
					error={errors.turnstile}
					errorId={`${formId}-turnstile-error`}
				/>
			) : null}
			{config.status === "loading" ? (
				<output className="block font-mono text-muted text-sm">
					Đang chuẩn bị bước xác minh…
				</output>
			) : null}
			{submitError ? (
				<Alert tone="danger" data-id="pro-interest-error">
					{submitError}
				</Alert>
			) : null}
		</form>
	);
}
