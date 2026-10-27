import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	buildInstallArgs,
	compareVersions,
	detectPackageManager,
	fetchLatestVersion,
} from "./cli-update-command.js";
import { VERSION } from "./version.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("VERSION", () => {
	it("matches the published package.json version", () => {
		const pkg = JSON.parse(
			readFileSync(path.resolve(here, "..", "package.json"), "utf-8"),
		);
		expect(VERSION).toBe(pkg.version);
	});
});

describe("compareVersions", () => {
	it("orders by major, minor, then patch", () => {
		expect(compareVersions("1.5.0", "1.4.1")).toBeGreaterThan(0);
		expect(compareVersions("1.4.1", "1.5.0")).toBeLessThan(0);
		expect(compareVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
		expect(compareVersions("1.4.10", "1.4.9")).toBeGreaterThan(0);
	});

	it("treats equal versions as equal, with or without a v prefix", () => {
		expect(compareVersions("1.4.1", "1.4.1")).toBe(0);
		expect(compareVersions("v1.4.1", "1.4.1")).toBe(0);
	});

	it("ignores prerelease suffixes rather than crashing", () => {
		expect(compareVersions("1.5.0-beta.1", "1.5.0")).toBe(0);
		expect(compareVersions("1.5.0-beta.1", "1.4.0")).toBeGreaterThan(0);
	});

	it("tolerates short version strings", () => {
		expect(compareVersions("2", "1.9.9")).toBeGreaterThan(0);
		expect(compareVersions("1.4", "1.4.0")).toBe(0);
	});
});

describe("detectPackageManager", () => {
	it("picks pnpm when installed under a pnpm global store", () => {
		expect(
			detectPackageManager("/home/u/.local/share/pnpm/global/5/node_modules/x"),
		).toBe("pnpm");
		expect(
			detectPackageManager("C:\\Users\\u\\AppData\\Local\\pnpm\\global\\5\\x"),
		).toBe("pnpm");
	});

	it("defaults to npm elsewhere", () => {
		expect(detectPackageManager("C:\\Users\\u\\AppData\\Roaming\\npm\\x")).toBe(
			"npm",
		);
		expect(detectPackageManager("/usr/lib/node_modules/tunelo")).toBe("npm");
	});
});

describe("buildInstallArgs", () => {
	it("uses the global install verb of each manager", () => {
		expect(buildInstallArgs("npm", "https://example.test/tunelo.tgz")).toEqual([
			"install",
			"-g",
			"https://example.test/tunelo.tgz",
		]);
		expect(buildInstallArgs("pnpm", "https://example.test/tunelo.tgz")).toEqual(
			["add", "-g", "https://example.test/tunelo.tgz"],
		);
	});
});

describe("fetchLatestVersion", () => {
	const answer = (status: number, body: unknown): typeof fetch =>
		(async () =>
			new Response(JSON.stringify(body), { status })) as typeof fetch;

	it("reads the version from the tag of the latest release", async () => {
		await expect(
			fetchLatestVersion(answer(200, { tag_name: "tunelo-v1.10.0" })),
		).resolves.toBe("1.10.0");
	});

	it("rejects a latest release that is not a Tunelo release", async () => {
		await expect(
			fetchLatestVersion(answer(200, { tag_name: "v2.0.0" })),
		).rejects.toThrow("not a Tunelo release");
	});

	it("rejects an error answer from GitHub", async () => {
		await expect(fetchLatestVersion(answer(403, {}))).rejects.toThrow("403");
	});
});
