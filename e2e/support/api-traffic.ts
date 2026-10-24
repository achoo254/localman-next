import type { Page, Request } from "@playwright/test";
import { WEB_ORIGIN } from "./ports.js";

export interface ApiTraffic {
	/** Paths of the requests the page sent to Localman so far. */
	paths(): string[];
	/**
	 * Every exchange with Localman (app API, MCP, auth) whose request or
	 * response carried `text`, as "METHOD /path (sent|received)".
	 */
	carrying(text: string): Promise<string[]>;
}

function labelOf(request: Request): string {
	const url = new URL(request.url());
	return `${request.method()} ${url.pathname}${url.search}`;
}

const fromLocalman = (request: Request): boolean =>
	new URL(request.url()).origin === WEB_ORIGIN;

/**
 * Records what the page sends to the Localman origin and what it gets
 * back, from now on: the proof that a value stayed in the browser. A body
 * is read the moment its request finishes, before a navigation could
 * drop it; a stream that never finishes (live events) is not read.
 */
export function watchApiTraffic(page: Page): ApiTraffic {
	const sent: { label: string; text: string }[] = [];
	const received: Promise<{ label: string; text: string }>[] = [];
	page.on("request", (request) => {
		if (!fromLocalman(request)) return;
		const url = new URL(request.url());
		sent.push({
			label: labelOf(request),
			text: `${url.search} ${request.postData() ?? ""}`,
		});
	});
	page.on("requestfinished", (request) => {
		if (!fromLocalman(request)) return;
		received.push(
			request
				.response()
				.then(async (response) => (response ? await response.text() : ""))
				.catch(() => "")
				.then((text) => ({ label: labelOf(request), text })),
		);
	});
	return {
		paths: () => sent.map(({ label }) => label),
		async carrying(text) {
			const out = sent
				.filter((entry) => entry.text.includes(text))
				.map(({ label }) => `${label} (sent)`);
			for (const entry of await Promise.all(received)) {
				if (entry.text.includes(text)) out.push(`${entry.label} (received)`);
			}
			return out;
		},
	};
}
