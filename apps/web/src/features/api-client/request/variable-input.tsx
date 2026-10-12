import { type ComponentProps, type ReactNode, useRef, useState } from "react";
import { cn } from "../../../lib/cn";
import {
	type InputAssistHandlers,
	useInputAssist,
} from "../../variables/use-input-assist";
import type { VariableKind } from "../../variables/variable-kinds";
import { findVariableSpans } from "../../variables/variable-spans";

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

const KIND_CLASS: Record<VariableKind, string> = {
	resolved: "bg-primary/12 text-primary",
	withheld:
		"bg-warning/12 text-warning-text underline decoration-warning decoration-dotted underline-offset-3",
	dynamic: "bg-accent/12 text-accent",
	undeclared:
		"bg-error/10 text-error-text underline decoration-error decoration-wavy underline-offset-3",
};

/**
 * `{{var}}` coloured by kind: without a variable assist (environments
 * off) every `{{var}}` is primary and `{{$dynamic}}` accent; with one,
 * undeclared names are red. Each span carries its name and offset for
 * the hover card.
 */
function highlight(
	text: string,
	classify: ((name: string) => VariableKind) | null,
): ReactNode[] {
	const parts: ReactNode[] = [];
	let last = 0;
	for (const span of findVariableSpans(text)) {
		if (span.from > last) parts.push(text.slice(last, span.from));
		const kind: VariableKind = classify
			? classify(span.name)
			: span.name.startsWith("$")
				? "dynamic"
				: "resolved";
		parts.push(
			<span
				key={span.from}
				data-var={span.name}
				data-from={span.from}
				data-kind={kind}
				className={cn("rounded-xs", KIND_CLASS[kind])}
			>
				{text.slice(span.from, span.to)}
			</span>,
		);
		last = span.to;
	}
	if (last < text.length) parts.push(text.slice(last));
	return parts;
}

type InputHandlers = Pick<
	ComponentProps<"input">,
	| "onMouseMove"
	| "onMouseLeave"
	| "onMouseUp"
	| "onKeyDown"
	| "onKeyUp"
	| "onSelect"
	| "onBlur"
>;

/** The caller's handlers first, then the assist's (both run). */
function withAssist(
	own: InputHandlers,
	assist: InputAssistHandlers | undefined,
): InputHandlers {
	if (!assist) return {};
	return {
		onMouseMove: (event) => {
			own.onMouseMove?.(event);
			assist.onMouseMove(event);
		},
		onMouseLeave: (event) => {
			own.onMouseLeave?.(event);
			assist.onMouseLeave();
		},
		onKeyDown: (event) => {
			own.onKeyDown?.(event);
			if (!event.defaultPrevented) assist.onKeyDown(event);
		},
		onMouseUp: (event) => {
			own.onMouseUp?.(event);
			assist.onMouseUp(event);
		},
		onKeyUp: (event) => {
			own.onKeyUp?.(event);
			assist.onKeyUp(event);
		},
		onSelect: (event) => {
			own.onSelect?.(event);
			assist.onSelect(event);
		},
		onBlur: (event) => {
			own.onBlur?.(event);
			assist.onBlur();
		},
	};
}

/**
 * Single-line text field that colours `{{variables}}`: a real `<input>`
 * (caret, selection, IME, autofill and screen readers behave as usual)
 * with transparent text over a highlighted copy that follows its scroll.
 * Inside a variable assist, the copy also places the hover card, the
 * `{{` suggestions and "Set as variable" (`useInputAssist`).
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
	const overlay = useRef<HTMLSpanElement>(null);
	const assist = useInputAssist(overlay, onValueChange);
	const hasVariables = value.includes("{{");
	return (
		<div className="relative min-w-0 flex-1">
			{hasVariables || assist ? (
				<div
					aria-hidden="true"
					className={cn(
						SHARED,
						PADDING[variant],
						variant === "field" && "rounded-md bg-surface",
						"pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre border border-transparent text-fg forced-colors:hidden",
						!hasVariables && "invisible",
					)}
				>
					<span
						ref={overlay}
						style={{ transform: `translateX(${-scrollLeft}px)` }}
					>
						{highlight(value, assist?.classify ?? null)}
					</span>
				</div>
			) : null}
			<input
				type="text"
				spellCheck={false}
				autoComplete="off"
				{...rest}
				{...assist?.attributes}
				{...withAssist(rest, assist?.handlers)}
				value={value}
				onChange={(event) => {
					onValueChange(event.target.value);
					assist?.changed(event.currentTarget);
				}}
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
