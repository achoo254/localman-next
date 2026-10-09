import { type ReactNode, useRef, useState } from "react";
import { logoutUrl } from "../../lib/api-url";
import { releasePushSubscriptionForLogout } from "../notifications/release-push-on-logout";

export interface Logout {
	/** Signing out: the push cleanup runs, then the page leaves. */
	busy: boolean;
	logout: () => Promise<void>;
	/** Hidden form to render once; logout is a top-level form POST. */
	form: ReactNode;
}

/**
 * Logout as the header and the invite page do it: detach this browser's
 * Web Push first (best effort), then POST `/auth/logout`, which ends the
 * session (and the IdP's) and redirects. Repeated calls are ignored.
 */
export function useLogout(formDataId: string): Logout {
	const formRef = useRef<HTMLFormElement>(null);
	const [busy, setBusy] = useState(false);
	const started = useRef(false);

	async function logout() {
		if (started.current) return;
		started.current = true;
		setBusy(true);
		await releasePushSubscriptionForLogout();
		formRef.current?.submit();
	}

	const form = (
		<form
			ref={formRef}
			method="post"
			action={logoutUrl()}
			data-id={formDataId}
			hidden
		/>
	);
	return { busy, logout, form };
}
