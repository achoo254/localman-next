import { afterEach, describe, expect, it, vi } from "vitest";
import {
	TUNNEL_CHOICE_EVENT,
	browserTunnelChoices,
	decideAutoTunnel,
} from "./auto-tunnel";
import type { LocalTunnel } from "./tunelo-accounts-api";

const A: LocalTunnel = {
	protocol: "http",
	url: "https://a.tunnel.hoandat.com",
	localPort: 3000,
	deviceName: "laptop",
	basicAuth: false,
};
const B: LocalTunnel = { ...A, url: "https://b.tunnel.hoandat.com" };
const TCP: LocalTunnel = { ...A, protocol: "tcp", url: "tcp://t.example:4000" };

afterEach(() => {
	window.localStorage.clear();
	vi.restoreAllMocks();
});

describe("decideAutoTunnel", () => {
	it("uses the only HTTP tunnel, or the remembered one among several", () => {
		expect(decideAutoTunnel([A, TCP], null)).toEqual({
			kind: "use",
			tunnel: A,
		});
		expect(decideAutoTunnel([A, B], B.url)).toEqual({ kind: "use", tunnel: B });
	});

	it("asks among several when none is remembered or the remembered one left", () => {
		expect(decideAutoTunnel([A, B], null)).toEqual({
			kind: "choose",
			tunnels: [A, B],
		});
		expect(
			decideAutoTunnel([A, B], "https://gone.tunnel.hoandat.com").kind,
		).toBe("choose");
	});

	it("tells TCP only, never opened, and stopped apart", () => {
		expect(decideAutoTunnel([TCP], null)).toEqual({ kind: "tcpOnly" });
		expect(decideAutoTunnel([], null)).toEqual({
			kind: "none",
			stopped: false,
		});
		expect(decideAutoTunnel([], A.url)).toEqual({
			kind: "none",
			stopped: true,
		});
	});
});

describe("browserTunnelChoices", () => {
	it("remembers a choice per local address and tells listeners", () => {
		const listener = vi.fn();
		window.addEventListener(TUNNEL_CHOICE_EVENT, listener);
		const choices = browserTunnelChoices();
		choices.set("localhost:3000", A.url);
		choices.set("localhost:4000", B.url);
		expect(browserTunnelChoices().get("localhost:3000")).toBe(A.url);
		expect(choices.get("localhost:4000")).toBe(B.url);
		expect(choices.get("localhost:5000")).toBeNull();
		expect(listener).toHaveBeenCalledTimes(2);
		window.removeEventListener(TUNNEL_CHOICE_EVENT, listener);
	});

	it("neither throws nor remembers when storage is unusable", () => {
		const broken = () => {
			throw new DOMException("denied", "SecurityError");
		};
		const choices = browserTunnelChoices(broken);
		expect(() => choices.set("localhost:3000", A.url)).not.toThrow();
		expect(choices.get("localhost:3000")).toBeNull();
		window.localStorage.setItem(
			"localman.apiClient.tunnelChoices",
			"{not json",
		);
		expect(browserTunnelChoices().get("localhost:3000")).toBeNull();
	});
});
