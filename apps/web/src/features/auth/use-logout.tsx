import { type ReactNode, useRef, useState } from "react";
import { logoutUrl } from "../../lib/api-url";
import { isNativeBuild } from "../../platform/native/native-build";
import { forgetSavedPages } from "../collections/page-storage";
import { releasePushSubscriptionForLogout } from "../notifications/release-push-on-logout";
import { lockVault } from "../secure-vault/vault-session";

export interface Logout {
	/** Signing out: the push cleanup runs, then the page leaves. */
	busy: boolean;
	logout: () => Promise<void>;
	/** Hidden form to render once; logout is a top-level form POST. */
	form: ReactNode;
}

/**
 * Logout as the header and the invite page do it: detach this browser's
 * Web Push first (best effort), lock the secret vault on this device (its
 * key for this account goes) and forget the open collection pages, then
 * POST `/auth/logout`, which ends the session (and the IdP's) and
 * redirects. Repeated calls are ignored.
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
		// Best effort: the page leaves next, which drops the key from memory.
		await lockVault().catch(() => undefined);
		forgetSavedPages();
		if (isNativeBuild) {
			// The shell ends its own session; the browser's IdP session stays.
			const { signOutOnDevice } = await import(
				"../../platform/native/mobile-sign-out"
			);
			await signOutOnDevice();
			return;
		}
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
