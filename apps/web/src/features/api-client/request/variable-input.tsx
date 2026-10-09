import { VARIABLE_PATTERN } from "@localman/shared/api-client";
import { type ComponentProps, type ReactNode, useState } from "react";
import { cn } from "../../../lib/cn";

export interface VariableInputProps
	extends Omit<ComponentProps<"input">, "value" | "onChange" | "size"> {
	value: string;
	onValueChange: (value: string) => void;
	/**
	 * `field`: framed like Input; `cell`: borderless inside a table row;
	 * `bare`: no frame, inside a box that draws its own (the URL bar).
	 */
	variant?: "field" | "cell" | "bare";
}

const SHARED = "font-mono text-sm";
const PADDING = {
	field: "min-h-11 px-3",
	cell: "min-h-9 px-2",
	bare: "min-h-11 px-3",
} as const;
/** Frame of each variant; colours are set apart (they change with variables). */
const FRAME = {
	field:
		"rounded-md border border-border-strong transition-[border-color,box-shadow] focus:border-primary focus:shadow-focus-primary",
	cell: "rounded-sm border border-transparent focus:border-primary",
	bare: "border border-transparent",
} as const;

/** `{{var}}` in primary, `{{$dynamic}}` in accent; the rest as plain text. */
function highlight(text: string): ReactNode[] {
	const parts: ReactNode[] = [];
	let last = 0;
	for (const match of text.matchAll(VARIABLE_PATTERN)) {
		const at = match.index ?? 0;
		if (at > last) parts.push(text.slice(last, at));
		const dynamic = match[1]?.trim().startsWith("$") ?? false;
		parts.push(
			<span
				key={at}
				className={cn(
					"rounded-xs",
					dynamic ? "bg-accent/12 text-accent" : "bg-primary/12 text-primary",
				)}
			>
				{match[0]}
			</span>,
		);
		last = at + match[0].length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return parts;
}

/**
 * Single-line text field that colours `{{variables}}`: a real `<input>`
 * (caret, selection, IME, autofill and screen readers behave as usual)
 * with transparent text over a highlighted copy that follows its scroll.
 */
export function VariableInput({
	value,
	onValueChange,
	variant = "field",
	className,
	onScroll,
	...rest
}: VariableInputProps) {
	const [scrollLeft, setScrollLeft] = useState(0);
	const hasVariables = value.includes("{{");
	return (
		<div className="relative min-w-0 flex-1">
			{hasVariables ? (
				<div
					aria-hidden="true"
					className={cn(
						SHARED,
						PADDING[variant],
						variant === "field" && "rounded-md bg-surface",
						"pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre border border-transparent text-fg forced-colors:hidden",
					)}
				>
					<span style={{ transform: `translateX(${-scrollLeft}px)` }}>
						{highlight(value)}
					</span>
				</div>
			) : null}
			<input
				type="text"
				spellCheck={false}
				autoComplete="off"
				{...rest}
				value={value}
				onChange={(event) => onValueChange(event.target.value)}
				onScroll={(event) => {
					setScrollLeft(event.currentTarget.scrollLeft);
					onScroll?.(event);
				}}
				className={cn(
					"relative w-full placeholder:text-muted placeholder:opacity-75 focus:outline-none",
					FRAME[variant],
					SHARED,
					PADDING[variant],
					hasVariables
						? "bg-transparent text-transparent caret-fg forced-colors:text-fg"
						: variant === "field"
							? "bg-surface text-fg"
							: "bg-transparent text-fg",
					className,
				)}
			/>
		</div>
	);
}
