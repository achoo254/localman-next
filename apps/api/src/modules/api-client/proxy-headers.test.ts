import type { HeaderEntry } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import {
	type OutgoingOptions,
	buildOutgoingHeaders as build,
	headersForRedirect,
	normalizeClientIp,
} from "./proxy-headers.js";

/** Outgoing headers without the proxy marker, which always ends the list. */
function buildOutgoingHeaders(
	envelope: readonly HeaderEntry[],
	options: OutgoingOptions,
): HeaderEntry[] {
	const headers = build(envelope, options);
	expect(headers.at(-1)).toEqual({ name: "X-Localman-Proxy", value: "1" });
	return headers.slice(0, -1);
}

const url = new URL("https://api.example.com:8443/users?page=1");
const base = {
	url,
	clientIp: null,
	forwardedProto: "https",
	contentLength: null,
	forceHost: false,
};

describe("outgoing proxy headers", () => {
	it("keeps the envelope's order and repeats, Host first from the URL", () => {
		const headers = buildOutgoingHeaders(
			[
				{ name: "Accept", value: "application/json" },
				{ name: "X-Tag", value: "a" },
				{ name: "Cookie", value: "a=1" },
				{ name: "X-Tag", value: "b" },
				{ name: "User-Agent", value: "Agent/1" },
			],
			base,
		);
		expect(headers).toEqual([
			{ name: "Host", value: "api.example.com:8443" },
			{ name: "Accept", value: "application/json" },
			{ name: "X-Tag", value: "a" },
			{ name: "Cookie", value: "a=1" },
			{ name: "X-Tag", value: "b" },
			{ name: "User-Agent", value: "Agent/1" },
		]);
	});

	it("keeps the user's Host override, once", () => {
		const headers = buildOutgoingHeaders(
			[
				{ name: "X-A", value: "1" },
				{ name: "host", value: "virtual.example" },
				{ name: "Host", value: "second.example" },
			],
			base,
		);
		expect(headers).toEqual([
			{ name: "host", value: "virtual.example" },
			{ name: "X-A", value: "1" },
		]);
	});

	it("drops hop-by-hop headers, the ones Connection lists, and Content-Length", () => {
		const headers = buildOutgoingHeaders(
			[
				{ name: "Connection", value: "keep-alive, X-Private" },
				{ name: "X-Private", value: "secret" },
				{ name: "Keep-Alive", value: "timeout=5" },
				{ name: "Transfer-Encoding", value: "chunked" },
				{ name: "TE", value: "trailers" },
				{ name: "Upgrade", value: "websocket" },
				{ name: "Proxy-Authorization", value: "Basic x" },
				{ name: "Proxy-Connection", value: "keep-alive" },
				{ name: "Content-Length", value: "999" },
				{ name: "X-Kept", value: "yes" },
			],
			{ ...base, contentLength: 3 },
		);
		expect(headers.map((h) => h.name)).toEqual([
			"Host",
			"X-Kept",
			"Content-Length",
		]);
		expect(headers.at(-1)?.value).toBe("3");
	});

	it("forwards the client IP: lists get it appended, X-Real-IP only when absent", () => {
		const fresh = buildOutgoingHeaders([], {
			...base,
			clientIp: "198.51.100.7",
		});
		expect(fresh.slice(1)).toEqual([
			{ name: "X-Forwarded-For", value: "198.51.100.7" },
			{ name: "X-Real-IP", value: "198.51.100.7" },
			{ name: "Forwarded", value: "for=198.51.100.7;proto=https" },
		]);
		const chained = buildOutgoingHeaders(
			[
				{ name: "x-forwarded-for", value: "203.0.113.1" },
				{ name: "X-Real-IP", value: "203.0.113.1" },
				{ name: "Forwarded", value: "for=203.0.113.1" },
			],
			{ ...base, clientIp: "::ffff:198.51.100.7" },
		);
		expect(chained.slice(1)).toEqual([
			{ name: "x-forwarded-for", value: "203.0.113.1, 198.51.100.7" },
			{ name: "X-Real-IP", value: "203.0.113.1" },
			{
				name: "Forwarded",
				value: "for=203.0.113.1, for=198.51.100.7;proto=https",
			},
		]);
	});

	it("quotes an IPv6 client in Forwarded", () => {
		const headers = buildOutgoingHeaders([], {
			...base,
			clientIp: "2001:db8::7",
			forwardedProto: "http",
		});
		expect(headers.at(-1)).toEqual({
			name: "Forwarded",
			value: 'for="[2001:db8::7]";proto=http',
		});
	});

	it("forces the URL's Host for a mock host", () => {
		const headers = buildOutgoingHeaders(
			[
				{ name: "Host", value: "other-vhost.example" },
				{ name: "X-A", value: "1" },
			],
			{ ...base, forceHost: true },
		);
		expect(headers).toEqual([
			{ name: "Host", value: "api.example.com:8443" },
			{ name: "X-A", value: "1" },
		]);
	});

	it("always marks the request, replacing a user's marker", () => {
		const headers = build(
			[
				{ name: "x-localman-proxy", value: "0" },
				{ name: "X-Localman-Proxy", value: "" },
			],
			base,
		);
		expect(headers).toEqual([
			{ name: "Host", value: "api.example.com:8443" },
			{ name: "X-Localman-Proxy", value: "1" },
		]);
	});

	it("normalizes mapped IPv4 and zone ids", () => {
		expect(normalizeClientIp("::ffff:10.1.2.3")).toBe("10.1.2.3");
		expect(normalizeClientIp("fe80::1%en0")).toBe("fe80::1");
		expect(normalizeClientIp("2001:db8::1")).toBe("2001:db8::1");
	});
});

describe("headers after a redirect", () => {
	const headers = [
		{ name: "Authorization", value: "Bearer t" },
		{ name: "Cookie", value: "a=1" },
		{ name: "Host", value: "virtual.example" },
		{ name: "Content-Type", value: "application/json" },
		{ name: "X-Kept", value: "1" },
	];

	it("keeps everything on the same origin", () => {
		expect(headersForRedirect(headers, false, false)).toEqual(headers);
	});

	it("drops credentials and the Host override on another origin", () => {
		const names = headersForRedirect(headers, true, false).map((h) => h.name);
		expect(names).toEqual(["Content-Type", "X-Kept"]);
	});

	it("drops the content headers with the body", () => {
		const names = headersForRedirect(headers, false, true).map((h) => h.name);
		expect(names).toEqual(["Authorization", "Cookie", "Host", "X-Kept"]);
	});
});
