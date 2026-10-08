import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonStyleOptions {
	variant?: ButtonVariant;
	size?: ButtonSize;
	block?: boolean;
}

const BASE =
	"inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap border font-mono font-semibold leading-none " +
	"transition-[scale,background-color,border-color,box-shadow,color,opacity] " +
	"motion-safe:enabled:hover:scale-103 motion-safe:enabled:active:scale-97 " +
	"disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none " +
	"[&_svg]:shrink-0";

const VARIANTS: Record<ButtonVariant, string> = {
	primary:
		"border-transparent bg-primary-solid text-on-primary shadow-glow-primary enabled:hover:bg-primary-solid-hover",
	secondary:
		"border-border bg-surface text-fg enabled:hover:border-[color-mix(in_srgb,var(--c-primary)_55%,var(--c-border))]",
	ghost:
		"border-transparent bg-transparent text-muted enabled:hover:bg-fg/6 enabled:hover:text-fg",
	danger:
		"border-transparent bg-error text-on-tone shadow-glow-error enabled:hover:bg-[color-mix(in_srgb,var(--c-error)_88%,var(--c-text))]",
};

const SIZES: Record<ButtonSize, string> = {
	sm: "min-h-8 rounded-sm px-3 text-[0.8125rem] pointer-coarse:min-h-10",
	md: "min-h-10 rounded-md px-4 text-sm pointer-coarse:min-h-11",
};

/** Class list shared by Button, IconButton and link-styled buttons. */
export function buttonClassName({
	variant = "secondary",
	size = "md",
	block = false,
}: ButtonStyleOptions = {}): string {
	return cn(BASE, VARIANTS[variant], SIZES[size], block && "w-full");
}

export interface ButtonProps
	extends ComponentProps<"button">,
		ButtonStyleOptions {
	/** Tabler icon (or any node) rendered before the label. */
	leadingIcon?: ReactNode;
}

export function Button({
	variant = "secondary",
	size = "md",
	block = false,
	leadingIcon,
	className,
	type = "button",
	children,
	...rest
}: ButtonProps) {
	return (
		<button
			type={type}
			data-variant={variant}
			data-size={size}
			className={cn(buttonClassName({ variant, size, block }), className)}
			{...rest}
		>
			{leadingIcon}
			{children}
		</button>
	);
}
