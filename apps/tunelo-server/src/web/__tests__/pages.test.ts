import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "vitest";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import type { TunnelSources } from "../../tunnel-directory.js";
import type { TunnelOwner } from "../../tunnel-owner.js";
import { LOCALES } from "../i18n/locale.js";
import { type WebHarness, startWebHarness } from "./web-harness.js";

useTestDatabase("web-pages");

const owner = (sub: string | null, deviceName: string): TunnelOwner => ({
	ownerSub: sub,
	deviceId: `${deviceName}-id`,
	deviceName,
});
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

let http: ReturnType<TunnelSources["http"]> = [];
let tcp: ReturnType<TunnelSources["tcp"]> = [];
const ALICE_TUNNELS: ReturnType<TunnelSources["http"]> = [
	{
		subdomain: "alice-web",
		owner: owner("acc_alice", "laptop"),
		localPort: 3000,
		connectedAt: minutesAgo(5),
		authHash: "h",
	},
	{
		subdomain: "alice-api",
		owner: owner("acc_alice", "desktop"),
		localPort: 8080,
		connectedAt: minutesAgo(90),
		authHash: undefined,
	},
	{
		subdomain: "bob-secret",
		owner: owner("acc_bob", "bob-box"),
		localPort: 4000,
		connectedAt: minutesAgo(1),
		authHash: undefined,
	},
	{
		subdomain: "anon-lab",
		owner: owner(null, "lab"),
		localPort: 5000,
		connectedAt: minutesAgo(1),
		authHash: undefined,
	},
];
const ALICE_TCP: ReturnType<TunnelSources["tcp"]> = [
	{
		port: 10_022,
		localPort: 22,
		allocatedAt: minutesAgo(2),
		owner: owner("acc_alice", "laptop"),
	},
	{
		port: 10_023,
		localPort: 5432,
		allocatedAt: minutesAgo(2),
		owner: owner("acc_bob", "bob-box"),
	},
];

let harness: WebHarness;
let session: string;

beforeAll(async () => {
	harness = await startWebHarness({ http: () => http, tcp: () => tcp });
	session = await harness.signIn();
});

afterAll(() => harness.close());

beforeEach(() => {
	http = ALICE_TUNNELS;
	tcp = ALICE_TCP;
});

function page(cookie?: string) {
	return harness.request("/", cookie ? { cookie } : {});
}

describe("signed-in tunnel list", () => {
	test("shows only the account's tunnels (HTTP and TCP), grouped by machine", async () => {
		const res = await page(session);
		expect(res.status).toBe(200);
		expect(res.body).toContain('href="https://alice-web.tunnel.hoandat.com"');
		expect(res.body).toContain("https://alice-api.tunnel.hoandat.com");
		expect(res.body).toContain("tcp://tunnel.hoandat.com:10022");
		expect(res.body).not.toContain("bob-secret");
		expect(res.body).not.toContain("bob-box");
		expect(res.body).not.toContain("10023");
		expect(res.body).not.toContain("anon-lab");
		expect(res.body.match(/data-id="machine-card"/g)).toHaveLength(2);
		expect(res.body.indexOf(">desktop<")).toBeLessThan(
			res.body.indexOf(">laptop<"),
		);
		expect(res.body).toContain("3 tunnels running");
		expect(res.body).toContain("5 minutes ago");
		expect(res.body).toContain("<dd>3000</dd>");
		expect(res.body).toContain("<dd>On</dd>");
		expect(res.body).toContain(`href="${harness.config.issuer}/account"`);
	});

	test("empty state explains CLI 1.6.x anonymous tunnels and tunelo login", async () => {
		http = ALICE_TUNNELS.filter((t) => t.owner.ownerSub !== "acc_alice");
		tcp = [];
		const res = await page(session);
		expect(res.body).toContain('data-id="tunnels-empty"');
		expect(res.body).toContain("CLI 1.6.x");
		expect(res.body).toContain("tunelo login");
		expect(res.body).not.toContain("bob-secret");
	});

	test.each(LOCALES)(
		"renders in %s with every placeholder filled",
		async (locale) => {
			for (const cookie of [
				`${session}; hd_lang=${locale}`,
				`hd_lang=${locale}`,
			]) {
				const res = await page(cookie);
				expect(res.body).toContain(`<html lang="${locale}">`);
				expect(res.body).not.toMatch(/\{\w+\}/);
			}
			http = [];
			tcp = [];
			const empty = await page(`${session}; hd_lang=${locale}`);
			expect(empty.body).not.toMatch(/\{\w+\}/);
		},
	);
});

describe("signed-out home", () => {
	test("introduction, getting started and the shared sign-in card", async () => {
		const res = await page();
		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toMatch(/text\/html/);
		// One call to action, the shared card's, worded like every hoandat.com app.
		expect(res.body.match(/data-id="sign-in-cta"/g)).toHaveLength(1);
		expect(res.body).toMatch(
			/<a[^>]*href="\/auth\/login"[^>]*data-id="sign-in-cta"|<a[^>]*data-id="sign-in-cta"[^>]*href="\/auth\/login"/,
		);
		expect(res.body).not.toContain('data-id="home-sign-in"');
		for (const command of [
			"npm install -g https://github.com/achoo254/localman-next/releases/latest/download/tunelo.tgz",
			"tunelo login",
			"tunelo http 3000",
		]) {
			expect(res.body).toContain(command);
		}
		expect(res.body).not.toContain("alice-web");
	});

	test("language from Accept-Language, then the switcher's cookie", async () => {
		const zh = await harness.request("/", {
			headers: { "accept-language": "zh-TW,zh;q=0.9" },
		});
		expect(zh.body).toContain('<html lang="zh-CN">');
		const set = await harness.request("/lang?set=vi");
		expect(set.status).toBe(303);
		expect(set.headers.location).toBe("/");
		expect(set.cookies.get("hd_lang")).toBe("vi");
		const bogus = await harness.request("/lang?set=fr");
		expect(bogus.cookies.has("hd_lang")).toBe(false);
	});

	test("the shared language cookie wins over Tunelo's older one", async () => {
		const both = await harness.request("/", {
			headers: { cookie: "tunelo_lang=zh-CN; hd_lang=vi" },
		});
		expect(both.body).toContain('<html lang="vi">');
		const legacy = await harness.request("/", {
			headers: { cookie: "tunelo_lang=zh-CN" },
		});
		expect(legacy.body).toContain('<html lang="zh-CN">');
	});

	test("a sign-in error is explained, unknown codes are ignored", async () => {
		const failed = await harness.request("/?error=login_failed");
		expect(failed.body).toContain('data-id="page-notice"');
		const odd = await harness.request("/?error=%3Cscript%3E");
		expect(odd.body).not.toContain("page-notice");
		// The only script tag is the shell's own file.
		expect(odd.body.match(/<script/g)).toHaveLength(1);
		expect(odd.body).not.toMatch(/<script>|&lt;script&gt;/);
	});
});
