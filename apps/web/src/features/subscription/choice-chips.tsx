import { type ReactNode, useId } from "react";
import type { Choice } from "./pro-interest-options";

export interface ChoiceChipsProps {
	type: "checkbox" | "radio";
	name: string;
	legend: ReactNode;
	/** Shows the same red `*` as FormField. */
	required?: boolean;
	/** Short muted note after the legend, e.g. "Choose one or more". */
	hint?: string;
	choices: readonly Choice[];
	selected: readonly string[];
	onToggle: (id: string) => void;
	error?: string;
	"data-id": string;
}

const CHIP =
	"inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 text-fg text-sm " +
	"transition-[border-color,background-color] hover:border-[color-mix(in_srgb,var(--c-primary)_55%,var(--c-border))] " +
	"has-checked:border-primary has-checked:bg-[color-mix(in_srgb,var(--c-primary)_8%,var(--c-surface))] " +
	"has-focus-visible:outline-2 has-focus-visible:outline-primary has-focus-visible:outline-offset-2";

/** Pill-shaped checkboxes or radios inside a labelled fieldset. */
export function ChoiceChips({
	type,
	name,
	legend,
	required = false,
	hint,
	choices,
	selected,
	onToggle,
	error,
	"data-id": dataId,
}: ChoiceChipsProps) {
	const errorId = `${useId()}-error`;
	return (
		<fieldset
			data-id={dataId}
			aria-describedby={error ? errorId : undefined}
			className="m-0 grid min-w-0 gap-2 border-0 p-0"
		>
			<legend className="mb-2 p-0 font-mono font-semibold text-[0.8125rem] text-fg">
				{legend}
				{required ? (
					<span aria-hidden="true" className="text-error">
						{" *"}
					</span>
				) : null}
				{hint ? (
					<span className="font-normal font-sans text-muted text-xs">
						{` ${hint}`}
					</span>
				) : null}
			</legend>
			<div className="flex flex-wrap gap-2">
				{choices.map((choice) => (
					<label
						key={choice.id}
						data-id={`${dataId}-${choice.id}`}
						className={CHIP}
					>
						<input
							type={type}
							name={name}
							value={choice.id}
							checked={selected.includes(choice.id)}
							onChange={() => onToggle(choice.id)}
							aria-invalid={error ? true : undefined}
							className="m-0 size-4 shrink-0 accent-(--c-primary)"
						/>
						{choice.label}
					</label>
				))}
			</div>
			{error ? (
				<p id={errorId} className="text-[0.8125rem] text-error">
					{error}
				</p>
			) : null}
		</fieldset>
	);
}
