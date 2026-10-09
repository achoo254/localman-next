import { describe, expect, it } from "vitest";
import {
	isLocalHostname,
	isLocalTarget,
	isLoopbackTarget,
	localTargetKey,
} from "./local-host.js";

describe("isLocalTarget", () => {
	it.each([
		"http://localhost:3000/users",
		"http://LOCALHOST./",
		"https://app.localhost/api",
		"localhost:5173",
		"http://127.0.0.1",
		"http://127.255.255.254:8080",
		"http://127.1",
		"http://2130706433/",
		"http://0x7f000001/",
		"http://0x7f.1/",
		"http://0177.0.0.1/",
		"http://[::1]:3000/",
		"http://[0:0:0:0:0:0:0:1]/",
		"http://[::]/",
		"http://0.0.0.0:3000",
		"http://0/",
		"http://10.0.0.1",
		"http://10.255.255.255",
		"http://172.16.0.1",
		"http://172.31.255.255",
		"http://192.168.1.10:8080",
		"http://169.254.169.254/latest/meta-data",
		"http://100.64.0.1",
		"http://100.127.255.255",
		"http://[fe80::1]/",
		"http://[febf::1]/",
		"http://[fd00::1]/",
		"http://[fc00::abcd]/",
		"http://[::ffff:127.0.0.1]/",
		"http://[::ffff:192.168.0.1]/",
		"http://3232235777/",
	])("%s is local", (url) => {
		expect(isLocalTarget(url)).toBe(true);
	});

	it.each([
		"https://api.example.com",
		"https://localhost.example.com",
		"https://mylocalhost/",
		"http://8.8.8.8",
		"http://172.15.255.255",
		"http://172.32.0.1",
		"http://192.169.0.1",
		"http://100.63.255.255",
		"http://100.128.0.1",
		"http://11.0.0.1",
		"http://[2001:db8::1]/",
		"http://[fec0::1]/",
		"http://[::ffff:8.8.8.8]/",
		"http://134744072/",
		"ftp://localhost/",
		"not a url at all",
		"",
	])("%s is not local", (url) => {
		expect(isLocalTarget(url)).toBe(false);
	});
});

describe("isLocalHostname", () => {
	it("accepts bare hosts and IPv6 with or without brackets", () => {
		expect(isLocalHostname("localhost")).toBe(true);
		expect(isLocalHostname("::1")).toBe(true);
		expect(isLocalHostname("[fd12::1]")).toBe(true);
		expect(isLocalHostname("2130706433")).toBe(true);
		expect(isLocalHostname("example.com")).toBe(false);
	});
});

describe("localTargetKey", () => {
	it.each([
		["http://localhost:3000/users?x=1", "localhost:3000", 3000],
		["http://127.0.0.1:3000", "localhost:3000", 3000],
		["http://127.1:3000", "localhost:3000", 3000],
		["http://[::1]:3000", "localhost:3000", 3000],
		["http://0.0.0.0:3000", "localhost:3000", 3000],
		["http://[::ffff:127.0.0.1]:3000", "localhost:3000", 3000],
		["http://localhost/", "localhost:80", 80],
		["https://localhost/", "localhost:443", 443],
		["localhost:8080", "localhost:8080", 8080],
		["http://app.localhost:5173", "app.localhost:5173", 5173],
		["http://192.168.1.5:8080", "192.168.1.5:8080", 8080],
		["http://[fd00::1]/", "[fd00::1]:80", 80],
	])("%s maps to %s", (url, key, port) => {
		expect(localTargetKey(url)).toEqual({ key, port });
	});

	it("is null for a public target", () => {
		expect(localTargetKey("https://api.example.com:8443/")).toBeNull();
		expect(localTargetKey("garbage")).toBeNull();
	});
});

describe("isLoopbackTarget", () => {
	it.each([
		"http://localhost:3000/users",
		"http://abc123.localhost:4610/users",
		"http://127.1:8080/",
		"http://[::1]:3000/",
	])("%s is loopback", (url) => {
		expect(isLoopbackTarget(url)).toBe(true);
	});

	it.each([
		"http://192.168.1.5:8080/",
		"http://10.0.0.1/",
		"http://[fd00::1]/",
		"https://example.com/",
		"http://localhost.example.com/",
	])("%s is not loopback", (url) => {
		expect(isLoopbackTarget(url)).toBe(false);
	});
});
