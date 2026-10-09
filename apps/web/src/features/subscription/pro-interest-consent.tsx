import { useId } from "react";
import { useT } from "../../i18n/i18n-context";

export interface ProInterestConsentProps {
	checked: boolean;
	/** Translated error, shown under the box and linked to it. */
	error: string | undefined;
	onChange: (checked: boolean) => void;
}

/** Required consent to store the email and contact the person about Pro. */
export function ProInterestConsent({
	checked,
	error,
	onChange,
}: ProInterestConsentProps) {
	const t = useT();
	const errorId = `${useId()}-consent-error`;
	return (
		<div className="grid gap-1.5">
			<label
				data-id="pro-interest-consent"
				className="flex min-h-11 cursor-pointer items-start gap-2 text-fg text-sm leading-normal"
			>
				<input
					type="checkbox"
					checked={checked}
					onChange={(event) => onChange(event.target.checked)}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? errorId : undefined}
					className="mt-0.5 size-4.5 shrink-0 accent-(--c-primary)"
				/>
				<span>{t("subscription.proInterest.fields.consent")}</span>
			</label>
			{error ? (
				<p id={errorId} className="text-[0.8125rem] text-error">
					{error}
				</p>
			) : null}
		</div>
	);
}
