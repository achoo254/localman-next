import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { renderLoginPage } from "../../api/render-login-page.js";
import { createBrandIconRouter } from "../brand-icons.js";
import { findStaticDir } from "../static-dir.js";

const FALLBACK = "relay";

interface Reply {
	readonly status: number;
	readonly type: string | undefined;
	readonly body: Buffer;
}

let server: http.Server;
let port: number;

beforeAll(async () => {
	const app = express();
	app.use(createBrandIconRouter(findStaticDir()));
	app.use((_req, res) => {
		res.status(400).type("text/plain").send(FALLBACK);
	});
	server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, resolve));
	port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function get(path: string, host: string): Promise<Reply> {
	return new Promise((resolve, reject) => {
		const req = http.request({ port, path, headers: { host } }, (res) => {
			const chunks: Buffer[] = [];
			res.on("data", (chunk: Buffer) => chunks.push(chunk));
			res.on("end", () =>
				resolve({
					status: res.statusCode ?? 0,
					type: res.headers["content-type"],
					body: Buffer.concat(chunks),
				}),
			);
		});
		req.on("error", reject);
		req.end();
	});
}

function staticFile(name: string): Buffer {
	return readFileSync(
		new URL(`../../../static/icons/${name}`, import.meta.url),
	);
}

describe("brand icons", () => {
	test("serves the favicon set on the apex host", async () => {
		const cases = [
			["/favicon.ico", "favicon.ico", /image\/(x-icon|vnd\.microsoft\.icon)/],
			["/icon.svg", "icon.svg", /image\/svg\+xml/],
			["/apple-touch-icon.png", "apple-touch-icon.png", /image\/png/],
		] as const;
		for (const [path, file, type] of cases) {
			const res = await get(path, "tunnel.hoandat.com");
			expect(res.status).toBe(200);
			expect(res.type).toMatch(type);
			expect(res.body.equals(staticFile(file))).toBe(true);
		}
	});

	test("tunnel subdomains keep every path for the user's app", async () => {
		for (const path of ["/favicon.ico", "/icon.svg", "/apple-touch-icon.png"]) {
			const res = await get(path, "myapp.tunnel.hoandat.com");
			expect(res.status).toBe(400);
			expect(res.body.toString()).toBe(FALLBACK);
		}
	});

	test("other paths on the apex pass through", async () => {
		const res = await get("/icons/favicon.ico", "tunnel.hoandat.com");
		expect(res.body.toString()).toBe(FALLBACK);
	});

	test("the device login page links the icons", () => {
		const page = renderLoginPage("req-1");
		expect(page).toContain('<link rel="icon" href="/favicon.ico"');
		expect(page).toContain('<link rel="icon" href="/icon.svg"');
		expect(page).toContain(
			'<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
		);
	});
});
