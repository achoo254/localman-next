import { PRO_INTEREST_NOTE_MAX } from "@localman/shared";
import { type RefObject, useId } from "react";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { ChoiceChips } from "./choice-chips";
import {
	type Choice,
	PRICE_HINTS,
	PRO_NEEDS,
	TEAM_SIZES,
} from "./pro-interest-options";
import type {
	ProInterestDraft,
	ProInterestErrors,
} from "./pro-interest-validation";

export interface ProInterestFieldsProps {
	draft: ProInterestDraft;
	errors: ProInterestErrors;
	/** Email came from the account (changes the hint). */
	prefilled: boolean;
	firstFieldRef: RefObject<HTMLInputElement | null>;
	firstField: "email" | "name";
	onChange: (patch: Partial<ProInterestDraft>) => void;
}

const OPTIONAL = (
	<span className="font-normal font-sans text-muted text-xs"> (tuỳ chọn)</span>
);

function pick<T extends string>(list: readonly Choice<T>[], id: string): T {
	const found = list.find((choice) => choice.id === id);
	if (!found) throw new Error(`Unknown choice "${id}"`);
	return found.id;
}

/** Inputs of the Pro interest form, controlled by the parent. */
export function ProInterestFields({
	draft,
	errors,
	prefilled,
	firstFieldRef,
	firstField,
	onChange,
}: ProInterestFieldsProps) {
	const consentErrorId = `${useId()}-consent-error`;
	return (
		<>
			<div className="grid items-start gap-4 sm:grid-cols-2">
				<FormField
					label="Email"
					required
					data-id="pro-interest-email"
					hint={
						prefilled
							? "Lấy từ tài khoản của bạn, sửa được."
							: "Chỉ dùng để liên hệ về gói Pro."
					}
					error={errors.email}
				>
					<Input
						ref={firstField === "email" ? firstFieldRef : undefined}
						type="email"
						inputMode="email"
						autoComplete="email"
						value={draft.email}
						onChange={(event) => onChange({ email: event.target.value })}
					/>
				</FormField>
				<FormField
					label="Tên"
					required
					data-id="pro-interest-name"
					error={errors.name}
				>
					<Input
						ref={firstField === "name" ? firstFieldRef : undefined}
						autoComplete="name"
						value={draft.name}
						onChange={(event) => onChange({ name: event.target.value })}
					/>
				</FormField>
			</div>
			<ChoiceChips
				type="checkbox"
				name="need"
				data-id="pro-interest-needs"
				required
				legend="Bạn cần gói Pro cho việc gì?"
				hint="Chọn một hoặc nhiều"
				choices={PRO_NEEDS}
				selected={draft.needs}
				error={errors.needs}
				onToggle={(id) => {
					const need = pick(PRO_NEEDS, id);
					onChange({
						needs: draft.needs.includes(need)
							? draft.needs.filter((item) => item !== need)
							: [...draft.needs, need],
					});
				}}
			/>
			<ChoiceChips
				type="radio"
				name="team"
				data-id="pro-interest-team"
				required
				legend="Quy mô team"
				choices={TEAM_SIZES}
				selected={draft.teamSize ? [draft.teamSize] : []}
				error={errors.teamSize}
				onToggle={(id) => onChange({ teamSize: pick(TEAM_SIZES, id) })}
			/>
			<FormField
				label={<>Mức giá sẵn sàng trả{OPTIONAL}</>}
				data-id="pro-interest-price"
			>
				<Select
					value={draft.priceHint}
					onChange={(event) => onChange({ priceHint: event.target.value })}
				>
					{PRICE_HINTS.map((choice) => (
						<option key={choice.id} value={choice.id}>
							{choice.label}
						</option>
					))}
				</Select>
			</FormField>
			<FormField
				label={<>Ghi chú{OPTIONAL}</>}
				data-id="pro-interest-note"
				error={errors.note}
			>
				<Textarea
					rows={3}
					maxLength={PRO_INTEREST_NOTE_MAX}
					placeholder="Ví dụ: team QA cần 30 project, chạy CI mỗi giờ"
					value={draft.note}
					onChange={(event) => onChange({ note: event.target.value })}
				/>
			</FormField>
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
						data-id="pro-interest-honeypot"
						value={draft.honeypot}
						onChange={(event) => onChange({ honeypot: event.target.value })}
					/>
				</label>
			</div>
			<div className="grid gap-1.5">
				<label
					data-id="pro-interest-consent"
					className="flex min-h-11 cursor-pointer items-start gap-2 text-fg text-sm leading-normal"
				>
					<input
						type="checkbox"
						checked={draft.consent}
						onChange={(event) => onChange({ consent: event.target.checked })}
						aria-invalid={errors.consent ? true : undefined}
						aria-describedby={errors.consent ? consentErrorId : undefined}
						className="mt-0.5 size-4.5 shrink-0 accent-(--c-primary)"
					/>
					<span>Tôi đồng ý cho Localman lưu email để liên hệ về gói Pro</span>
				</label>
				{errors.consent ? (
					<p id={consentErrorId} className="text-[0.8125rem] text-error">
						{errors.consent}
					</p>
				) : null}
			</div>
		</>
	);
}
