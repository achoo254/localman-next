/** Whole device-flow sign-in (RFC 8628) into a caller-chosen session store. */
import {
	type DeviceAuthorization,
	type PollOptions,
	deviceNameForIdp,
	pollForTokens,
	startDeviceAuthorization,
} from "./device-login.js";
import { withFileLock } from "./file-lock.js";
import { discover } from "./idp-client.js";
import { resourceOfIssuer } from "./server-identity.js";
import type { SessionStore, StoredSession } from "./session-store.js";
import { sessionFromTokens } from "./session.js";

export interface DeviceSignInOptions {
	/** IdP to sign in at, e.g. `serverIdentity(serverUrl).issuer`. */
	issuer: string;
	/** Receives the new session once the user approves. */
	store: SessionStore;
	/** Shown on the IdP's approval page; defaults to the host name. */
	deviceName?: string | undefined;
	/** Show the user `verificationUriComplete` (or `verificationUri` and
	 *  `userCode`); polling starts once this resolves. */
	onCode: (authorization: DeviceAuthorization) => void | Promise<void>;
	poll?: PollOptions | undefined;
}

/**
 * Signs in and saves the session (under the store's lock) before returning
 * it. Throws `DeviceLoginError` when the user denies or the code expires.
 * A session already in the store is replaced, not revoked: revoke it first
 * with `revokeToken` if the old grant should end.
 */
export async function deviceSignIn(
	options: DeviceSignInOptions,
): Promise<StoredSession> {
	const { issuer, store } = options;
	const endpoints = await discover(issuer);
	const resource = resourceOfIssuer(issuer);
	const authorization = await startDeviceAuthorization(
		endpoints,
		deviceNameForIdp(options.deviceName),
		resource,
	);
	await options.onCode(authorization);
	const tokens = await pollForTokens(endpoints, authorization, {
		resource,
		...options.poll,
	});
	const session = sessionFromTokens(issuer, tokens, undefined, Date.now());
	await withFileLock(store.lockPath, async () => store.save(session));
	return session;
}
