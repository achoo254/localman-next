import { describe, expect, test } from "vitest";
import {
	type TunnelSources,
	listByDeviceId,
	listByOwner,
} from "../tunnel-directory.js";
import type { TunnelOwner } from "../tunnel-owner.js";

const at = new Date("2026-10-09T10:00:00Z");
const laptop: TunnelOwner = {
	ownerSub: "acc_a",
	deviceId: "m1",
	deviceName: "laptop",
};
const desktop: TunnelOwner = {
	ownerSub: "acc_a",
	deviceId: "m2",
	deviceName: "desktop",
};
const anon: TunnelOwner = { ownerSub: null, deviceId: "m3", deviceName: "ci" };
/** Claims the anonymous machine's id but belongs to an account. */
const spoof: TunnelOwner = {
	ownerSub: "acc_b",
	deviceId: "m3",
	deviceName: "x",
};

const sources: TunnelSources = {
	http: () => [
		{
			subdomain: "web",
			owner: laptop,
			localPort: 3000,
			connectedAt: at,
			authHash: "h",
		},
		{
			subdomain: "anon",
			owner: anon,
			localPort: 8080,
			connectedAt: at,
			authHash: undefined,
		},
		{
			subdomain: "spoof",
			owner: spoof,
			localPort: 1,
			connectedAt: at,
			authHash: undefined,
		},
	],
	tcp: () => [
		{ port: 10001, localPort: 5432, allocatedAt: at, owner: desktop },
	],
};

describe("tunnel directory", () => {
	test("listByOwner gathers HTTP and TCP tunnels from every machine", () => {
		expect(listByOwner("acc_a", sources)).toEqual([
			{
				subdomain: "web",
				url: "https://web.tunnel.hoandat.com",
				protocol: "http",
				localPort: 3000,
				deviceName: "laptop",
				connectedAt: "2026-10-09T10:00:00.000Z",
				basicAuth: true,
			},
			{
				subdomain: null,
				url: "tcp://tunnel.hoandat.com:10001",
				protocol: "tcp",
				localPort: 5432,
				publicPort: 10001,
				deviceName: "desktop",
				connectedAt: "2026-10-09T10:00:00.000Z",
				basicAuth: false,
			},
		]);
	});

	test("listByDeviceId sees only its own anonymous machine", () => {
		expect(listByDeviceId("m3", sources).map((t) => t.subdomain)).toEqual([
			"anon",
		]);
		expect(listByDeviceId("m1", sources)).toEqual([]);
	});
});
