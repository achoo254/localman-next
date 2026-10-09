/**
 * Cloudflare Turnstile in the browser. The script is only fetched when a
 * widget is rendered, so pages without the form never contact Cloudflare.
 * A desktop/mobile shell can replace this module without touching the form.
 */

const SCRIPT_URL =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileRenderOptions {
	sitekey: string;
	action?: string;
	language?: string;
	/** "flexible" fills the container width, so narrow modals do not clip it. */
	size?: "normal" | "flexible" | "compact";
	callback?: (token: string) => void;
	"expired-callback"?: () => void;
	"error-callback"?: () => void;
}

interface TurnstileApi {
	render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
	remove: (widgetId: string) => void;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

export interface TurnstileCallbacks {
	onToken: (token: string) => void;
	/** Token expired or the challenge failed: a new one is needed. */
	onReset: () => void;
}

/** Widget operations once the script is ready; `render` returns the widget id. */
export interface TurnstileClient {
	render: (
		container: HTMLElement,
		siteKey: string,
		callbacks: TurnstileCallbacks,
	) => string;
	remove: (widgetId: string) => void;
}

/** Server-side verification checks this value, so tokens cannot be reused elsewhere. */
export const TURNSTILE_ACTION = "pro_interest";

let loading: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	loading ??= new Promise<TurnstileApi>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => {
			if (window.turnstile) resolve(window.turnstile);
			else reject(new Error("Turnstile script loaded without its API"));
		};
		script.onerror = () => {
			loading = null;
			script.remove();
			reject(new Error("Turnstile script failed to load"));
		};
		document.head.append(script);
	});
	return loading;
}

/**
 * Loads the script once (shared by every caller). Rendering is a separate,
 * synchronous step so a component can skip it when it unmounted meanwhile
 * (React StrictMode mounts effects twice).
 */
export async function loadTurnstile(): Promise<TurnstileClient> {
	const api = await loadScript();
	return {
		render: (container, siteKey, { onToken, onReset }) =>
			api.render(container, {
				sitekey: siteKey,
				action: TURNSTILE_ACTION,
				language: "vi",
				size: "flexible",
				callback: onToken,
				"expired-callback": onReset,
				"error-callback": onReset,
			}),
		remove: (widgetId) => api.remove(widgetId),
	};
}
