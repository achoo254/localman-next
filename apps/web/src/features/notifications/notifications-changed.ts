const inbox = new EventTarget();
const CHANGED = "changed";

/** Tells every mounted bell that the inbox changed, e.g. a test was stored. */
export function announceNotificationsChanged(): void {
	inbox.dispatchEvent(new Event(CHANGED));
}

/** Calls `listener` on each announcement; returns the unsubscribe. */
export function onNotificationsChanged(listener: () => void): () => void {
	inbox.addEventListener(CHANGED, listener);
	return () => inbox.removeEventListener(CHANGED, listener);
}
