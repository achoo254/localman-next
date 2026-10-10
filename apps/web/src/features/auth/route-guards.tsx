import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { allowAutoLoginRedirect } from "../../lib/login-redirect-guard";
import { navigateToLogin } from "../../platform/navigation";
import { AuthStatus } from "./auth-status";
import type { CurrentUser } from "./current-user";
import { useCurrentUser } from "./use-current-user";

/**
 * Renders `children(user)` for a signed-in user. Anyone else is sent to the
 * IdP and comes back to the page they asked for, unless that already
 * happened too often in a short time (see login-redirect-guard).
 */
export function RequireAuth({
	children,
}: {
	children: (user: CurrentUser) => ReactNode;
}) {
	const session = useCurrentUser();
	const location = useLocation();
	const returnTo = `${location.pathname}${location.search}${location.hash}`;
	const anonymous = session.status === "anonymous";
	const [blocked, setBlocked] = useState(false);
	// One attempt per anonymous episode; the ref survives StrictMode's
	// double effect run so a single page load counts once.
	const attempted = useRef(false);

	useEffect(() => {
		if (!anonymous) {
			attempted.current = false;
			setBlocked(false);
			return;
		}
		if (attempted.current) return;
		attempted.current = true;
		if (allowAutoLoginRedirect()) navigateToLogin({ returnTo });
		else setBlocked(true);
	}, [anonymous, returnTo]);

	switch (session.status) {
		case "authenticated":
			return children(session.user);
		case "anonymous":
			return blocked ? (
				<AuthStatus kind="loginLoop" />
			) : (
				<AuthStatus kind="redirecting" />
			);
		case "error":
			return <AuthStatus kind="error" error={session.error} />;
		default:
			return <AuthStatus kind="loading" />;
	}
}
