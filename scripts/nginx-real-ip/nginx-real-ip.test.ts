/**
 * Tenant server blocks name their own client-IP sources, so the rate limits
 * and access logs see the visitor even once the IdP drops its http-level
 * `set_real_ip_from 127.0.0.1`. The mock runtime trusts no header at all.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** https://www.cloudflare.com/ips-v4 and ips-v6, as in auth-next/src/tenants/cloudflare-ips.ts. */
const CLOUDFLARE_RANGES = [
	"173.245.48.0/20",
	"103.21.244.0/22",
	"103.22.200.0/22",
	"103.31.4.0/22",
	"141.101.64.0/18",
	"108.162.192.0/18",
	"190.93.240.0/20",
	"188.114.96.0/20",
	"197.234.240.0/22",
	"198.41.128.0/17",
	"162.158.0.0/15",
	"104.16.0.0/13",
	"104.24.0.0/14",
	"172.64.0.0/13",
	"131.0.72.0/22",
	"2400:cb00::/32",
	"2606:4700::/32",
	"2803:f800::/32",
	"2405:b500::/32",
	"2405:8100::/32",
	"2a06:98c0::/29",
	"2c0f:f248::/32",
];

const TENANT_CONFS = [
	"../../infra/localman/nginx/localman-tenants.conf",
	"../../infra/tunelo/nginx-tenants.conf",
];

/** Top-level `server { ... }` blocks, braces balanced. */
function serverBlocks(text: string): string[] {
	const blocks: string[] = [];
	for (const start of text.matchAll(/^server \{/gm)) {
		let depth = 0;
		for (let i = start.index; i < text.length; i++) {
			if (text[i] === "{") depth++;
			if (text[i] === "}" && --depth === 0) {
				blocks.push(text.slice(start.index, i + 1));
				break;
			}
		}
	}
	return blocks;
}

function directives(block: string, name: string): string[] {
	const pattern = new RegExp(`^\\s*${name}\\s+([^;]+);`, "gm");
	return [...block.matchAll(pattern)].map((match) => match[1]?.trim() ?? "");
}

/** A block that reaches an app: the others only answer with a status. */
function forwards(block: string): boolean {
	return /^\s*(proxy_pass|include)\s/m.test(block);
}

describe.each(TENANT_CONFS)("%s", (path) => {
	const text = readFileSync(
		fileURLToPath(new URL(path, import.meta.url)),
		"utf8",
	);
	const blocks = serverBlocks(text);
	const mock = blocks.filter((block) =>
		directives(block, "set_real_ip_from").includes("unix:"),
	);
	const served = blocks.filter(
		(block) => forwards(block) && !mock.includes(block),
	);

	it("has at least one block that forwards to the app", () => {
		expect(served.length).toBeGreaterThan(0);
	});

	it("trusts loopback and Cloudflare in every forwarding block", () => {
		for (const block of served) {
			expect(directives(block, "real_ip_header")).toEqual(["CF-Connecting-IP"]);
			expect(directives(block, "real_ip_recursive")).toEqual(["on"]);
			expect(directives(block, "set_real_ip_from")).toEqual([
				"127.0.0.1",
				...CLOUDFLARE_RANGES,
			]);
		}
	});

	it("keeps the mock runtime on the TCP peer", () => {
		for (const block of mock) {
			expect(directives(block, "set_real_ip_from")).toEqual(["unix:"]);
			expect(directives(block, "real_ip_header")).toEqual([]);
		}
	});
});
