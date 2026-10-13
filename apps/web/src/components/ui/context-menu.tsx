import * as RadixContextMenu from "@radix-ui/react-context-menu";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
	MENU_CONTENT_CLASS,
	MENU_ITEM_CLASS,
	MENU_SEPARATOR_CLASS,
} from "./menu-styles";

/**
 * Right-click menu (also the ContextMenu key and Shift+F10 on the focused
 * trigger), styled like `DropdownMenu`.
 */
export const ContextMenu = RadixContextMenu.Root;
export const ContextMenuTrigger = RadixContextMenu.Trigger;

export function ContextMenuContent({
	className,
	...rest
}: ComponentProps<typeof RadixContextMenu.Content>) {
	return (
		<RadixContextMenu.Portal>
			<RadixContextMenu.Content
				collisionPadding={8}
				className={cn(MENU_CONTENT_CLASS, className)}
				{...rest}
			/>
		</RadixContextMenu.Portal>
	);
}

export interface ContextMenuItemProps
	extends ComponentProps<typeof RadixContextMenu.Item> {
	/** Tabler icon element shown before the label. */
	icon?: ReactNode;
}

export function ContextMenuItem({
	icon,
	className,
	children,
	...rest
}: ContextMenuItemProps) {
	return (
		<RadixContextMenu.Item
			className={cn(
				MENU_ITEM_CLASS,
				"text-fg [&_svg]:text-icon-muted",
				className,
			)}
			{...rest}
		>
			{icon}
			{children}
		</RadixContextMenu.Item>
	);
}

export function ContextMenuSeparator({
	className,
	...rest
}: ComponentProps<typeof RadixContextMenu.Separator>) {
	return (
		<RadixContextMenu.Separator
			className={cn(MENU_SEPARATOR_CLASS, className)}
			{...rest}
		/>
	);
}
