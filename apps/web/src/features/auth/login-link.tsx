import type { ComponentProps, MouseEvent } from "react";
import { type LoginOptions, loginUrl } from "../../lib/api-url";
import { isPlainLeftClick } from "../../lib/is-plain-left-click";
import { navigateToLogin } from "../../platform/navigation";

/**
 * The app's sign-in page: the shared sign-in card, and the target of the
 * public header's "Sign in" where sign-in has nowhere particular to return.
 * `?returnTo=` names the in-app path to come back to.
 */
export const LOGIN_PAGE_PATH = "/login";

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
	recreate,
	onClick,
	...rest
}: LoginLinkProps) {
	function handleClick(event: MouseEvent<HTMLAnchorElement>) {
		onClick?.(event);
		if (event.defaultPrevented || !isPlainLeftClick(event)) return;
		event.preventDefault();
		navigateToLogin({ returnTo, prompt, recreate });
	}
	return (
		<a
			href={loginUrl({ returnTo, prompt, recreate })}
			onClick={handleClick}
			{...rest}
		/>
	);
}
