/**
 * Web Push through the browser's service worker and PushManager. Exposed as
 * one object so a native shell (or a test) can swap the implementation.
 */

const SERVICE_WORKER_URL = "/sw.js";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

/** Thrown when the user (or browser policy) refuses notifications. */
export class PushPermissionError extends Error {
	constructor(readonly permission: PushPermission) {
		super(`Notification permission is ${permission}`);
		this.name = "PushPermissionError";
	}
}

function isSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window
	);
}

function permission(): PushPermission {
	return isSupported() ? Notification.permission : "unsupported";
}

/** VAPID keys are URL-safe base64; PushManager wants raw bytes. */
export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
	const binary = atob(padded);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function existingSubscription(): Promise<PushSubscription | null> {
	if (!isSupported()) return null;
	const registration =
		await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
	return registration ? registration.pushManager.getSubscription() : null;
}

/** Endpoint of this browser's subscription, or null when not subscribed. */
async function currentEndpoint(): Promise<string | null> {
	const subscription = await existingSubscription();
	return subscription?.endpoint ?? null;
}

/** Asks for permission, registers the worker and subscribes this browser. */
async function subscribe(
	vapidPublicKey: string,
): Promise<PushSubscriptionJSON> {
	if (!isSupported()) throw new PushPermissionError("unsupported");
	const result = await Notification.requestPermission();
	if (result !== "granted") throw new PushPermissionError(result);
	await navigator.serviceWorker.register(SERVICE_WORKER_URL);
	const registration = await navigator.serviceWorker.ready;
	const subscription =
		(await registration.pushManager.getSubscription()) ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: decodeBase64Url(vapidPublicKey),
		}));
	return subscription.toJSON();
}

/** Removes this browser's subscription; resolves even if there was none. */
async function unsubscribe(): Promise<void> {
	const subscription = await existingSubscription();
	if (subscription) await subscription.unsubscribe();
}

export const pushSupport = {
	isSupported,
	permission,
	currentEndpoint,
	subscribe,
	unsubscribe,
};
