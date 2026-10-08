import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { type ButtonVariant, buttonClassName } from "./button";

export type IconButtonSize = "sm" | "md";

export interface IconButtonProps
	extends Omit<ComponentProps<"button">, "children" | "aria-label"> {
	/** Accessible name; icon-only buttons have no visible text. */
	label: string;
	/** Tabler icon element, e.g. `<IconX stroke={1.5} />`. */
	icon: ReactNode;
	variant?: ButtonVariant;
	size?: IconButtonSize;
}

const SQUARE: Record<IconButtonSize, string> = {
	sm: "size-8 min-h-8 px-0 pointer-coarse:size-10",
	md: "size-9 min-h-9 px-0 pointer-coarse:size-11",
};

export function IconButton({
	label,
	icon,
	variant = "ghost",
	size = "md",
	className,
	type = "button",
	...rest
}: IconButtonProps) {
	return (
		<button
			type={type}
			aria-label={label}
			data-variant={variant}
			className={cn(
				buttonClassName({ variant, size }),
				SQUARE[size],
				className,
			)}
			{...rest}
		>
			{icon}
		</button>
	);
}
