import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { IconCheck } from "@tabler/icons-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";

export const DropdownMenu = RadixMenu.Root;
export const DropdownMenuTrigger = RadixMenu.Trigger;
export const DropdownMenuRadioGroup = RadixMenu.RadioGroup;
/** Groups related items, e.g. the actions under one entry (`role="group"`). */
export const DropdownMenuGroup = RadixMenu.Group;

export interface DropdownMenuContentProps
	extends ComponentProps<typeof RadixMenu.Content> {}

export function DropdownMenuContent({
	className,
	sideOffset = 6,
	align = "end",
	...rest
}: DropdownMenuContentProps) {
	return (
		<RadixMenu.Portal>
			<RadixMenu.Content
				sideOffset={sideOffset}
				align={align}
				collisionPadding={8}
				className={cn(
					"z-80 min-w-50 rounded-md border border-border bg-surface p-1 text-fg shadow-lg",
					"data-[state=closed]:animate-fade-out data-[state=open]:animate-pop-in",
					className,
				)}
				{...rest}
			/>
		</RadixMenu.Portal>
	);
}

const ITEM_CLASS = cn(
	"flex min-h-10 w-full cursor-pointer select-none items-center gap-2 rounded-sm px-3 font-mono text-[0.8125rem] outline-none",
	"data-disabled:cursor-not-allowed data-highlighted:bg-fg/6 data-disabled:opacity-45",
);

export interface DropdownMenuItemProps
	extends ComponentProps<typeof RadixMenu.Item> {
	/** Tabler icon element shown before the label. */
	icon?: ReactNode;
	/** Destructive action styling (error colour). */
	danger?: boolean;
}

export function DropdownMenuItem({
	icon,
	danger = false,
	className,
	children,
	...rest
}: DropdownMenuItemProps) {
	return (
		<RadixMenu.Item
			className={cn(
				ITEM_CLASS,
				danger ? "text-error" : "text-fg [&_svg]:text-icon-muted",
				className,
			)}
			{...rest}
		>
			{icon}
			{children}
		</RadixMenu.Item>
	);
}

/**
 * One choice of a `DropdownMenuRadioGroup` (`role="menuitemradio"` with
 * `aria-checked`); the chosen item shows a check mark.
 */
export function DropdownMenuRadioItem({
	className,
	children,
	...rest
}: ComponentProps<typeof RadixMenu.RadioItem>) {
	return (
		<RadixMenu.RadioItem
			className={cn(ITEM_CLASS, "text-fg [&_svg]:text-primary", className)}
			{...rest}
		>
			<span className="inline-flex size-4 shrink-0" aria-hidden="true">
				<RadixMenu.ItemIndicator>
					<IconCheck size={16} />
				</RadixMenu.ItemIndicator>
			</span>
			{children}
		</RadixMenu.RadioItem>
	);
}

export function DropdownMenuSeparator({
	className,
	...rest
}: ComponentProps<typeof RadixMenu.Separator>) {
	return (
		<RadixMenu.Separator
			className={cn("my-1 h-px bg-border-subtle", className)}
			{...rest}
		/>
	);
}

/** Non-interactive heading or note inside a menu (not a menuitem). */
export function DropdownMenuLabel({
	className,
	...rest
}: ComponentProps<typeof RadixMenu.Label>) {
	return (
		<RadixMenu.Label
			className={cn("px-3 py-2 font-mono text-muted text-xs", className)}
			{...rest}
		/>
	);
}

/**
 * Menu item that renders its child as it is (`asChild`), without the row
 * styling: a real button inside a menu that arrow keys still reach.
 */
export function DropdownMenuControlItem(
	props: Omit<ComponentProps<typeof RadixMenu.Item>, "asChild">,
) {
	return <RadixMenu.Item asChild {...props} />;
}
