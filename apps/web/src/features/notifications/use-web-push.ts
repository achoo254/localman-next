import { useCallback, useEffect, useState } from "react";
import { PushPermissionError, pushSupport } from "../../platform/push-support";
import {
	deletePushSubscription,
	fetchVapidPublicKey,
	savePushSubscription,
} from "./notification-preferences-api";

/**
 * - checking: reading this browser's subscription
 * - unsupported: no service worker / PushManager / Notification API
 * - unavailable: the server has no VAPID key configured
 * - denied: the user blocked notifications for this site
 * - off / on: whether this browser holds a subscription
 */
export type WebPushStatus =
	| "checking"
	| "unsupported"
	| "unavailable"
	| "denied"
	| "off"
	| "on";

/** Thrown by `enable` when the server has no VAPID key. */
export class WebPushUnavailableError extends Error {
	constructor() {
		super("Web Push is not configured on the server");
		this.name = "WebPushUnavailableError";
	}
}

export function useWebPush(serverAvailable: boolean) {
	const [status, setStatus] = useState<WebPushStatus>("checking");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		async function detect(): Promise<WebPushStatus> {
			if (!pushSupport.isSupported()) return "unsupported";
			if (!serverAvailable) return "unavailable";
			if (pushSupport.permission() === "denied") return "denied";
			return (await pushSupport.currentEndpoint()) ? "on" : "off";
		}
		detect()
			.catch((): WebPushStatus => "off")
			.then((next) => {
				if (!cancelled) setStatus(next);
			});
		return () => {
			cancelled = true;
		};
	}, [serverAvailable]);

	const enable = useCallback(async () => {
		setBusy(true);
		try {
			const publicKey = await fetchVapidPublicKey();
			if (!publicKey) {
				setStatus("unavailable");
				throw new WebPushUnavailableError();
			}
			const subscription = await pushSupport.subscribe(publicKey);
			try {
				await savePushSubscription(subscription);
			} catch (error) {
				// The server never stored it, so do not leave an orphan in the
				// browser; the original error is the one worth reporting.
				await pushSupport.unsubscribe().catch(() => undefined);
				throw error;
			}
			setStatus("on");
		} catch (error) {
			if (error instanceof PushPermissionError) {
				setStatus(error.permission === "denied" ? "denied" : "off");
			}
			throw error;
		} finally {
			setBusy(false);
		}
	}, []);

	const disable = useCallback(async () => {
		setBusy(true);
		try {
			const endpoint = await pushSupport.currentEndpoint();
			if (endpoint) await deletePushSubscription(endpoint);
			await pushSupport.unsubscribe();
			setStatus("off");
		} finally {
			setBusy(false);
		}
	}, []);

	return { status, busy, enable, disable };
}
