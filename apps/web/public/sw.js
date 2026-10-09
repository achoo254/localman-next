/*
 * Localman service worker: shows Web Push notifications and opens their link
 * on click. It deliberately has no fetch handler and caches nothing.
 *
 * Push payload (JSON): { title, body, link } where `link` is an in-app path.
 */

const DEFAULT_TITLE = "Localman";

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

/** Same-origin URL for a link, or the app root for anything else. */
function sameOriginUrl(link) {
	try {
		const url = new URL(
			typeof link === "string" ? link : "/",
			self.location.origin,
		);
		if (url.origin === self.location.origin) return url.href;
	} catch {
		// Malformed link: fall through to the app root.
	}
	return new URL("/", self.location.origin).href;
}

function readPayload(event) {
	if (!event.data) return {};
	try {
		const data = event.data.json();
		return data && typeof data === "object" ? data : {};
	} catch {
		return { body: event.data.text() };
	}
}

self.addEventListener("push", (event) => {
	const payload = readPayload(event);
	const title =
		typeof payload.title === "string" && payload.title !== ""
			? payload.title
			: DEFAULT_TITLE;
	const body = typeof payload.body === "string" ? payload.body : "";
	event.waitUntil(
		self.registration.showNotification(title, {
			body,
			data: { url: sameOriginUrl(payload.link) },
		}),
	);
});

async function focusOrOpen(targetUrl) {
	const windows = await self.clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});
	const exact = windows.find((client) => client.url === targetUrl);
	if (exact) return exact.focus();
	const sameOrigin = windows.find(
		(client) => new URL(client.url).origin === self.location.origin,
	);
	if (sameOrigin) {
		try {
			const focused = await sameOrigin.focus();
			return await focused.navigate(targetUrl);
		} catch {
			// Uncontrolled tabs cannot be navigated; open a new one instead.
		}
	}
	return self.clients.openWindow(targetUrl);
}

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const targetUrl = sameOriginUrl(event.notification.data?.url);
	event.waitUntil(focusOrOpen(targetUrl));
});
