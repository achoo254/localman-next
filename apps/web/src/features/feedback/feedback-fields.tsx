import {
	CONTACT_HANDLE_MAX,
	CONTACT_MESSAGE_MAX,
	CONTACT_NAME_MAX,
} from "@localman/shared/constants";
import type { RefObject } from "react";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { useI18n } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import {
	FEEDBACK_CATEGORIES,
	type FeedbackDraft,
	type FeedbackError,
	type FeedbackErrors,
} from "./feedback-draft";

export interface FeedbackFieldsProps {
	draft: FeedbackDraft;
	errors: FeedbackErrors;
	/** The message box, focused when the form opens. */
	firstFieldRef: RefObject<HTMLTextAreaElement | null>;
	/** Which fields were filled from the account (changes their hints). */
	prefilled: { name: boolean; contact: boolean };
	onChange: (patch: Partial<FeedbackDraft>) => void;
}

/** Text of a field error, in the current language. */
export function feedbackErrorText(
	t: Translate,
	error: FeedbackError | undefined,
): string | undefined {
	switch (error) {
		case undefined:
			return undefined;
		case "messageTooLong":
			return t("feedback.errors.messageTooLong", { max: CONTACT_MESSAGE_MAX });
		case "nameTooLong":
			return t("feedback.errors.nameTooLong", { max: CONTACT_NAME_MAX });
		default:
			return t(`feedback.errors.${error}`);
	}
}

function Optional() {
	const { t } = useI18n();
	return (
		<span className="font-normal font-sans text-muted text-xs">
			{" "}
			{t("common.optional")}
		</span>
	);
}

function toCategory(value: string): FeedbackDraft["category"] {
	return (
		FEEDBACK_CATEGORIES.find((choice) => choice.id === value)?.id ?? "feedback"
	);
}

/** Inputs of the feedback form, controlled by the parent. */
export function FeedbackFields({
	draft,
	errors,
	firstFieldRef,
	prefilled,
	onChange,
}: FeedbackFieldsProps) {
	const { t, formatNumber } = useI18n();
	const category = FEEDBACK_CATEGORIES.find(
		(choice) => choice.id === draft.category,
	);
	const fromAccount = t("feedback.fields.fromAccount");
	return (
		<>
			<FormField
				label={t("feedback.fields.kind")}
				data-id="modal-feedback-kind"
			>
				<Select
					value={draft.category}
					onChange={(event) =>
						onChange({ category: toCategory(event.target.value) })
					}
				>
					{FEEDBACK_CATEGORIES.map((choice) => (
						<option key={choice.id} value={choice.id}>
							{t(`feedback.categories.${choice.key}.label`)}
						</option>
					))}
				</Select>
			</FormField>
			<FormField
				label={t("feedback.fields.message")}
				required
				data-id="modal-feedback-body"
				hint={t("feedback.fields.length", {
					length: formatNumber(draft.message.trim().length),
					max: formatNumber(CONTACT_MESSAGE_MAX),
				})}
				error={feedbackErrorText(t, errors.message)}
			>
				<Textarea
					ref={firstFieldRef}
					rows={5}
					maxLength={CONTACT_MESSAGE_MAX}
					placeholder={
						category
							? t(`feedback.categories.${category.key}.placeholder`)
							: undefined
					}
					value={draft.message}
					onChange={(event) => onChange({ message: event.target.value })}
				/>
			</FormField>
			<div className="grid items-start gap-4 sm:grid-cols-2">
				<FormField
					label={
						<>
							{t("feedback.fields.name")}
							<Optional />
						</>
					}
					data-id="modal-feedback-name"
					hint={prefilled.name ? fromAccount : undefined}
					error={feedbackErrorText(t, errors.name)}
				>
					<Input
						autoComplete="name"
						maxLength={CONTACT_NAME_MAX}
						value={draft.name}
						onChange={(event) => onChange({ name: event.target.value })}
					/>
				</FormField>
				<FormField
					label={
						<>
							{t("feedback.fields.contact")}
							<Optional />
						</>
					}
					data-id="modal-feedback-contact"
					hint={
						prefilled.contact ? fromAccount : t("feedback.fields.contactHint")
					}
					error={feedbackErrorText(t, errors.contact)}
				>
					<Input
						autoComplete="email"
						maxLength={CONTACT_HANDLE_MAX}
						placeholder={t("feedback.fields.contactPlaceholder")}
						value={draft.contact}
						onChange={(event) => onChange({ contact: event.target.value })}
					/>
				</FormField>
			</div>
			{/* Honeypot: hidden from people and assistive tech, bots fill it. The
			    name avoids words browsers autofill (website, url, company…). */}
			<div aria-hidden="true" className="sr-only">
				<label>
					{t("feedback.fields.honeypot")}
					<input
						name="contact_extra"
						tabIndex={-1}
						autoComplete="off"
						aria-hidden="true"
						data-id="modal-feedback-honeypot"
						value={draft.honeypot}
						onChange={(event) => onChange({ honeypot: event.target.value })}
					/>
				</label>
			</div>
		</>
	);
}
