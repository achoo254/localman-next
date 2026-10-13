import { IDP_DEFAULTS } from "./idp-client.js";

/**
 * What a Tunelo server stands for, by convention from its host and never
 * from anything the server says: `tunnel.<domain>` is served for the IdP
 * `https://auth.<domain>`, and tokens for it carry the audience
 * `https://tunnel.<domain>`. `undefined` for any other host (loopback,
 * custom servers).
 */
export function serverIdentity(
	serverUrl: string,
): { readonly issuer: string; readonly resource: string } | undefined {
	let url: URL;
	try {
		url = new URL(serverUrl);
	} catch {
		return undefined;
	}
	const [label, ...rest] = url.hostname.split(".");
	if (label !== "tunnel" || rest.length < 2) return undefined;
	const domain = rest.join(".");
	return {
		issuer: `https://auth.${domain}`,
		resource: `https://tunnel.${domain}`,
	};
}

/**
 * The audience to ask the IdP `issuer` for: `https://tunnel.<domain>` of
 * `https://auth.<domain>`; the default one for any other issuer (a local
 * or staging IdP set with `TUNELO_AUTH_ISSUER`).
 */
export function resourceOfIssuer(issuer: string): string {
	let host: string;
	try {
		host = new URL(issuer).hostname;
	} catch {
		return IDP_DEFAULTS.resource;
	}
	return host.startsWith("auth.")
		? `https://tunnel.${host.slice("auth.".length)}`
		: IDP_DEFAULTS.resource;
}
