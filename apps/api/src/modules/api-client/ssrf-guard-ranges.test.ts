import { describe, expect, it } from "vitest";
import {
	blockListOf,
	builtInBlockList,
	isBlockedAddress,
	parseCidr,
} from "./ssrf-guard-ranges.js";

const list = builtInBlockList();

describe("blocked address ranges", () => {
	it.each([
		"127.0.0.1",
		"127.255.255.254",
		"0.0.0.0",
		"10.0.0.1",
		"172.16.0.1",
		"172.31.255.255",
		"192.168.1.1",
		"169.254.169.254",
		"100.64.0.1",
		"100.100.100.200",
		"192.0.0.192",
		"198.18.0.1",
		"224.0.0.1",
		"255.255.255.255",
		"::",
		"::1",
		"::ffff:127.0.0.1",
		"::ffff:7f00:1",
		"::ffff:a9fe:a9fe",
		"64:ff9b::a00:1",
		"2002:a00:1::1",
		"2001:0:4136:e378::1",
		"fc00::1",
		"fd00:ec2::254",
		"fe80::1",
		"fe80::1%en0",
		"ff02::1",
		"not-an-ip",
	])("refuses %s", (address) => {
		expect(isBlockedAddress(list, address)).toBe(true);
	});

	it.each([
		"8.8.8.8",
		"1.1.1.1",
		"172.32.0.1",
		"100.128.0.1",
		"2606:4700:4700::1111",
	])("lets public %s through", (address) => {
		expect(isBlockedAddress(list, address)).toBe(false);
	});

	it("adds the operator's CIDRs", () => {
		const extra = blockListOf(["203.0.113.65", "2606:4700::/32"]);
		expect(isBlockedAddress(extra, "203.0.113.65")).toBe(true);
		expect(isBlockedAddress(extra, "203.0.113.66")).toBe(false);
		expect(isBlockedAddress(extra, "2606:4700:4700::1111")).toBe(true);
	});

	it("parses IPs and CIDRs only", () => {
		expect(parseCidr("10.0.0.0/8")).toEqual({
			address: "10.0.0.0",
			prefix: 8,
			family: "ipv4",
		});
		expect(parseCidr("::1")).toEqual({
			address: "::1",
			prefix: 128,
			family: "ipv6",
		});
		for (const bad of [
			"10.0.0.0/33",
			"::/129",
			"host",
			"1.2.3.4/x",
			"1.2.3.4/8/8",
			"",
		]) {
			expect(parseCidr(bad)).toBeNull();
		}
	});
});
