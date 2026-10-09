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
import { formatNumber } from "../../lib/format";
import {
	FEEDBACK_CATEGORIES,
	type FeedbackDraft,
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

const OPTIONAL = (
	<span className="font-normal font-sans text-muted text-xs"> (tuỳ chọn)</span>
);

const FROM_ACCOUNT = "Lấy từ tài khoản của bạn.";

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
	const category = FEEDBACK_CATEGORIES.find(
		(choice) => choice.id === draft.category,
	);
	return (
		<>
			<FormField label="Loại" data-id="modal-feedback-kind">
				<Select
					value={draft.category}
					onChange={(event) =>
						onChange({ category: toCategory(event.target.value) })
					}
				>
					{FEEDBACK_CATEGORIES.map((choice) => (
						<option key={choice.id} value={choice.id}>
							{choice.label}
						</option>
					))}
				</Select>
			</FormField>
			<FormField
				label="Nội dung"
				required
				data-id="modal-feedback-body"
				hint={`${formatNumber(draft.message.trim().length)}/${formatNumber(CONTACT_MESSAGE_MAX)} ký tự`}
				error={errors.message}
			>
				<Textarea
					ref={firstFieldRef}
					rows={5}
					maxLength={CONTACT_MESSAGE_MAX}
					placeholder={category?.placeholder}
					value={draft.message}
					onChange={(event) => onChange({ message: event.target.value })}
				/>
			</FormField>
			<div className="grid items-start gap-4 sm:grid-cols-2">
				<FormField
					label={<>Tên{OPTIONAL}</>}
					data-id="modal-feedback-name"
					hint={prefilled.name ? FROM_ACCOUNT : undefined}
					error={errors.name}
				>
					<Input
						autoComplete="name"
						maxLength={CONTACT_NAME_MAX}
						value={draft.name}
						onChange={(event) => onChange({ name: event.target.value })}
					/>
				</FormField>
				<FormField
					label={<>Email hoặc Telegram{OPTIONAL}</>}
					data-id="modal-feedback-contact"
					hint={
						prefilled.contact
							? FROM_ACCOUNT
							: "Để lại nếu bạn muốn được trả lời."
					}
					error={errors.contact}
				>
					<Input
						autoComplete="email"
						maxLength={CONTACT_HANDLE_MAX}
						placeholder="ban@example.com hoặc @username"
						value={draft.contact}
						onChange={(event) => onChange({ contact: event.target.value })}
					/>
				</FormField>
			</div>
			{/* Honeypot: hidden from people and assistive tech, bots fill it. The
			    name avoids words browsers autofill (website, url, company…). */}
			<div aria-hidden="true" className="sr-only">
				<label>
					Không điền ô này
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
