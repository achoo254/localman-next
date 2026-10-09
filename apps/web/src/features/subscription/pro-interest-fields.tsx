import { PRO_INTEREST_NOTE_MAX } from "@localman/shared";
import type { RefObject } from "react";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { ChoiceChips } from "./choice-chips";
import { ProInterestConsent } from "./pro-interest-consent";
import {
	type Choice,
	priceHints,
	proNeedsFor,
	teamSizes,
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
	const t = useT();
	const needs = proNeedsFor(useFeatures(), t);
	const teams = teamSizes(t);
	// A field error is a message key, translated here so it follows the language.
	const error = (field: keyof ProInterestErrors) => {
		const key = errors[field];
		return key ? t(key) : undefined;
	};
	const optional = (
		<span className="font-normal font-sans text-muted text-xs">
			{` ${t("common.optional")}`}
		</span>
	);
	return (
		<>
			<div className="grid items-start gap-4 sm:grid-cols-2">
				<FormField
					label={t("subscription.proInterest.fields.email")}
					required
					data-id="pro-interest-email"
					hint={
						prefilled
							? t("subscription.proInterest.fields.emailHintPrefilled")
							: t("subscription.proInterest.fields.emailHint")
					}
					error={error("email")}
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
					label={t("subscription.proInterest.fields.name")}
					required
					data-id="pro-interest-name"
					error={error("name")}
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
				legend={t("subscription.proInterest.fields.needs")}
				hint={t("subscription.proInterest.fields.needsHint")}
				choices={needs}
				selected={draft.needs}
				error={error("needs")}
				onToggle={(id) => {
					const need = pick(needs, id);
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
				legend={t("subscription.proInterest.fields.team")}
				choices={teams}
				selected={draft.teamSize ? [draft.teamSize] : []}
				error={error("teamSize")}
				onToggle={(id) => onChange({ teamSize: pick(teams, id) })}
			/>
			<FormField
				label={
					<>
						{t("subscription.proInterest.fields.price")}
						{optional}
					</>
				}
				data-id="pro-interest-price"
			>
				<Select
					value={draft.priceHint}
					onChange={(event) => onChange({ priceHint: event.target.value })}
				>
					{priceHints(t).map((choice) => (
						<option key={choice.id} value={choice.id}>
							{choice.label}
						</option>
					))}
				</Select>
			</FormField>
			<FormField
				label={
					<>
						{t("subscription.proInterest.fields.note")}
						{optional}
					</>
				}
				data-id="pro-interest-note"
				error={error("note")}
			>
				<Textarea
					rows={3}
					maxLength={PRO_INTEREST_NOTE_MAX}
					placeholder={t("subscription.proInterest.fields.notePlaceholder")}
					value={draft.note}
					onChange={(event) => onChange({ note: event.target.value })}
				/>
			</FormField>
			{/* Honeypot: hidden from people and assistive tech, bots fill it. The
			    name avoids words browsers autofill (website, url, company…). */}
			<div aria-hidden="true" className="sr-only">
				<label>
					{t("subscription.proInterest.fields.honeypot")}
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
			<ProInterestConsent
				checked={draft.consent}
				error={error("consent")}
				onChange={(consent) => onChange({ consent })}
			/>
		</>
	);
}
