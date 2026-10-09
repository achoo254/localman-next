import type { ComponentProps, MouseEvent } from "react";
import { isPlainLeftClick } from "../../lib/is-plain-left-click";
import { openExternal, safeExternalUrl } from "../../platform/navigation";

export interface ExternalLinkProps extends ComponentProps<"a"> {
	href: string;
}

/**
 * Link to another site, opened through the platform (new tab on the web).
 * Only http(s) addresses become links; any other scheme renders the text
 * without `href`, so it can neither run nor open.
 */
export function ExternalLink({ href, onClick, ...rest }: ExternalLinkProps) {
	const safeHref = safeExternalUrl(href);
	function handleClick(event: MouseEvent<HTMLAnchorElement>) {
		onClick?.(event);
		if (safeHref === null) {
			event.preventDefault();
			return;
		}
		if (event.defaultPrevented || !isPlainLeftClick(event)) return;
		event.preventDefault();
		openExternal(safeHref);
	}
	return (
		<a
			href={safeHref ?? undefined}
			target="_blank"
			rel="noopener noreferrer"
			onClick={handleClick}
			{...rest}
		/>
	);
}
