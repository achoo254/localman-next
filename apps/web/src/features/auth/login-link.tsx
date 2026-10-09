import type { ComponentProps, MouseEvent } from "react";
import { type LoginOptions, loginUrl } from "../../lib/api-url";
import { isPlainLeftClick } from "../../lib/is-plain-left-click";
import { navigateToLogin } from "../../platform/navigation";

export interface LoginLinkProps
	extends Omit<ComponentProps<"a">, "href">,
		LoginOptions {}

/**
 * Link to `/auth/login`. Plain clicks go through the platform navigation;
 * modified clicks (new tab, …) keep the browser default.
 */
export function LoginLink({
	returnTo,
	prompt,
	onClick,
	...rest
}: LoginLinkProps) {
	function handleClick(event: MouseEvent<HTMLAnchorElement>) {
		onClick?.(event);
		if (event.defaultPrevented || !isPlainLeftClick(event)) return;
		event.preventDefault();
		navigateToLogin({ returnTo, prompt });
	}
	return (
		<a href={loginUrl({ returnTo, prompt })} onClick={handleClick} {...rest} />
	);
}
