import type { ComponentProps } from "react";
import { Link, useInRouterContext } from "react-router";

export interface AppLinkProps extends Omit<ComponentProps<"a">, "href"> {
	to: string;
}

/**
 * Link to a page of the app. The plan dialogs also render outside a router
 * (component tests of the screens that open them); a plain link still
 * reaches the page there.
 */
export function AppLink({ to, ...rest }: AppLinkProps) {
	return useInRouterContext() ? (
		<Link to={to} {...rest} />
	) : (
		<a href={to} {...rest} />
	);
}
