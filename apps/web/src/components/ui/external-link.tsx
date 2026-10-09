import type { ComponentProps, MouseEvent } from "react";
import { isPlainLeftClick } from "../../lib/is-plain-left-click";
import { openExternal } from "../../platform/navigation";

export interface ExternalLinkProps extends ComponentProps<"a"> {
	href: string;
}

/** Link to another site, opened through the platform (new tab on the web). */
export function ExternalLink({ href, onClick, ...rest }: ExternalLinkProps) {
	function handleClick(event: MouseEvent<HTMLAnchorElement>) {
		onClick?.(event);
		if (event.defaultPrevented || !isPlainLeftClick(event)) return;
		event.preventDefault();
		openExternal(href);
	}
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			onClick={handleClick}
			{...rest}
		/>
	);
}
