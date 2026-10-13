/**
 * TEST ONLY. A user agent for the IdP's browser endpoints: keeps its
 * cookies, follows redirects by hand and stops before requesting a URL
 * that starts with `stopAt` (the Localman callback).
 */
export class TestBrowser {
	private readonly cookies = new Map<string, string>();

	/** `send` reaches the IdP (a tenant's IdP through its loopback fetch). */
	constructor(
		private readonly send: (
			url: URL,
			init: RequestInit,
		) => Promise<Response> = (url, init) => fetch(url, init),
	) {}

	async request(
		url: string | URL,
		form?: Record<string, string>,
	): Promise<Response> {
		const headers = new Headers();
		const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
		if (cookie) headers.set("cookie", cookie);
		const body = form ? new URLSearchParams(form) : undefined;
		if (body) headers.set("content-type", "application/x-www-form-urlencoded");
		const response = await this.send(new URL(url), {
			method: body ? "POST" : "GET",
			headers,
			body,
			redirect: "manual",
		});
		for (const header of response.headers.getSetCookie()) {
			const [pair = ""] = header.split(";");
			const separator = pair.indexOf("=");
			const name = pair.slice(0, separator).trim();
			const value = pair.slice(separator + 1).trim();
			const expired = /expires=Thu, 01 Jan 1970/i.test(header);
			if (!value || expired) this.cookies.delete(name);
			else this.cookies.set(name, value);
		}
		return response;
	}

	/** Follows redirects; returns the first URL under `stopAt`, if reached. */
	async navigate(
		url: string | URL,
		stopAt: string,
		form?: Record<string, string>,
	): Promise<{ response: Response; stoppedAt?: URL }> {
		let current = new URL(url);
		let response = await this.request(current, form);
		for (let hops = 0; hops < 20; hops += 1) {
			const target = response.headers.get("location");
			if (response.status < 300 || response.status >= 400 || !target) {
				return { response };
			}
			current = new URL(target, current);
			if (current.href.startsWith(stopAt))
				return { response, stoppedAt: current };
			response = await this.request(current);
		}
		throw new Error("Too many redirects");
	}
}

/** Reads a hidden form field from provider HTML. */
export function formField(html: string, name: string): string {
	const match = new RegExp(`name="${name}" value="([^"]+)"`).exec(html);
	if (!match?.[1]) throw new Error(`Form field ${name} not found`);
	return match[1];
}
