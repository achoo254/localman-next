import { OperationError } from "@localman/operations";
import type { ClientResponse } from "@localman/shared/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { routeLocalTarget } from "../api-client/local-target-route.js";
import { checkMachineAnswer } from "./machine-forward-errors.js";
import {
	type FakeSelfLinks,
	fakeForwardUrl,
	useFakeSelfLinks,
} from "./testing/fake-self-links.js";
import { useTuneloTestEnv } from "./testing/tunelo-test-setup.js";
import { httpTunnel } from "./testing/tunnel-rows.js";
import { TunnelLinkModel, linkTokenSlot } from "./tunelo-link-model.js";
import { setTuneloDeps } from "./tunelo-runtime.js";

const env = useTuneloTestEnv();
const ALICE = "acc_alice";
const BOB = "acc_bob";
const SESSION = `session-${ALICE}`;

let selfLinks: FakeSelfLinks;
beforeEach(() => {
	selfLinks = useFakeSelfLinks(env.tunelo);
});

/** A machine Alice's `tunelo` linked, as the self-link stores it. */
async function ownMachine(
	deviceId: string,
	extra: Record<string, unknown> = {},
): Promise<{ id: string; token: string }> {
	const { token } = selfLinks.mint(ALICE, deviceId);
	const row = await TunnelLinkModel.create({
		userSub: ALICE,
		status: "linked",
		source: "self",
		deviceId,
		machineName: deviceId,
		forwardUrl: fakeForwardUrl(deviceId),
		forwardEnabled: true,
		...extra,
	});
	const id = String(row._id);
	const sealed = env.cipher.encrypt(token, linkTokenSlot(ALICE, id));
	await TunnelLinkModel.updateOne({ _id: id }, { tokenSealed: sealed });
	return { id, token };
}

async function refusal(promise: Promise<unknown>): Promise<OperationError> {
	const error = await promise.then(
		() => null,
		(caught: unknown) => caught,
	);
	if (!(error instanceof OperationError)) throw new Error("expected a refusal");
	return error;
}

describe("a localhost target on the user's own machine", () => {
	it("goes to the one machine with its token and port as headers", async () => {
		const { id, token } = await ownMachine("tunelo.pc");
		const route = await routeLocalTarget(
			ALICE,
			null,
			"http://127.0.0.1:5173/api/x?y=1#frag",
		);
		expect(route).toEqual({
			url: `${fakeForwardUrl("tunelo.pc")}/api/x?y=1`,
			tunnel: new URL(fakeForwardUrl("tunelo.pc")).origin,
			headers: [
				{ name: "Tunelo-Access", value: token },
				{ name: "Tunelo-Local-Port", value: "5173" },
			],
			machine: id,
			machineToken: token,
		});
	});

	it("prefers a tunnel the user opened for the port", async () => {
		await ownMachine("tunelo.pc");
		env.tunelo.setAccountTunnels(ALICE, [httpTunnel("web", 5173)]);
		const route = await routeLocalTarget(
			ALICE,
			SESSION,
			"http://localhost:5173/",
		);
		expect(route.machine).toBeUndefined();
		expect(route.tunnel).toBe("https://web.tunnel.hoandat.com");
	});

	it("asks which machine when there are several, and takes the one named", async () => {
		await ownMachine("tunelo.a");
		const { id: b } = await ownMachine("tunelo.b");
		const several = await refusal(
			routeLocalTarget(ALICE, null, "http://localhost:3000/"),
		);
		expect(several.code).toBe("PROXY_MACHINE_AMBIGUOUS");
		const named = await routeLocalTarget(
			ALICE,
			null,
			"http://localhost:3000/",
			b,
		);
		expect(named.machine).toBe(b);
	});

	it("never reaches a machine that is off, someone else's, or not on localhost", async () => {
		const { id: off } = await ownMachine("tunelo.off", {
			forwardEnabled: false,
		});
		expect(
			(await refusal(routeLocalTarget(ALICE, null, "http://localhost:1/", off)))
				.code,
		).toBe("MACHINE_FORWARD_OFF");
		// An off machine is not picked on its own either.
		expect(
			(await refusal(routeLocalTarget(ALICE, null, "http://localhost:1/")))
				.code,
		).toBe("PROXY_TARGET_BLOCKED");
		const { id: on } = await ownMachine("tunelo.on");
		expect(
			(await refusal(routeLocalTarget(BOB, null, "http://localhost:1/", on)))
				.code,
		).toBe("MACHINE_NOT_FOUND");
		expect(
			(
				await refusal(
					routeLocalTarget(ALICE, null, "http://192.168.1.5:80/", on),
				)
			).code,
		).toBe("PROXY_MACHINE_TARGET");
		expect(
			(await refusal(routeLocalTarget(ALICE, null, "https://example.com/", on)))
				.code,
		).toBe("PROXY_MACHINE_TARGET");
	});

	it("lists machines and their ports for agents", async () => {
		const { id, token } = await ownMachine("tunelo.pc");
		const seen: Array<{ url: string; access: string | null }> = [];
		setTuneloDeps({
			...env.deps,
			fetch: async (url, init) => {
				const headers = new Headers(init.headers);
				seen.push({ url, access: headers.get("tunelo-access") });
				return new Response(
					JSON.stringify({
						ports: [
							{ port: 9222, name: "chrome" },
							{ port: 5173, name: "no\u001b[31mde" },
							{ port: 3000 },
						],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			},
		});
		const machines = await as(ALICE).get("/client/machines");
		expect(machines.body.machines).toEqual([
			expect.objectContaining({ id, name: "tunelo.pc", revoked: false }),
		]);
		const ports = await as(ALICE).get(`/client/machines/${id}/ports`);
		expect(ports.body.ports).toEqual([
			{ port: 3000, name: null },
			{ port: 5173, name: "no[31mde" },
		]);
		expect(seen).toEqual([
			{
				url: `${fakeForwardUrl("tunelo.pc")}/ports`,
				access: token,
			},
		]);
	});
});

function answer(
	finalUrl: string,
	code: string | null,
	status: number,
): ClientResponse {
	return {
		status,
		statusText: "",
		headers: code ? [{ name: "Tunelo-Forward-Error", value: code }] : [],
		body: "",
		bodyEncoding: "utf8",
		size: 0,
		timings: { dns: null, connect: null, tls: null, ttfb: null, total: 0 },
		finalUrl,
		truncated: false,
	};
}

describe("refusals of Tunelo or the machine", () => {
	it("become API errors when the code comes with its status", async () => {
		const { id, token } = await ownMachine("tunelo.pc");
		const tunnel = new URL(fakeForwardUrl("tunelo.pc")).origin;
		const route = { machine: id, tunnel, token };
		const at = `${tunnel}/.tunelo/forward/x`;
		const cases: Array<[string, number, string]> = [
			["TUNELO_TUNNEL_002", 502, "MACHINE_OFFLINE"],
			["TUNELO_FORWARD_002", 403, "MACHINE_PORT_BLOCKED"],
			["TUNELO_FORWARD_003", 403, "MACHINE_FORWARD_DISABLED"],
			["TUNELO_FORWARD_004", 400, "MACHINE_BAD_PORT"],
			["TUNELO_FORWARD_005", 502, "MACHINE_PORT_CLOSED"],
			["TUNELO_FORWARD_006", 429, "MACHINE_RATE_LIMITED"],
		];
		for (const [code, status, expected] of cases) {
			const error = await refusal(
				checkMachineAnswer(ALICE, route, answer(at, code, status)),
			);
			expect(error.code).toBe(expected);
		}
		// The same code with another status is the app's own answer.
		await expect(
			checkMachineAnswer(ALICE, route, answer(at, "TUNELO_FORWARD_003", 200)),
		).resolves.toBeUndefined();
	});

	it("marks a link dead only when Tunelo refuses its token", async () => {
		const { id, token } = await ownMachine("tunelo.pc");
		const tunnel = new URL(fakeForwardUrl("tunelo.pc")).origin;
		const route = { machine: id, tunnel, token };
		const at = `${tunnel}/.tunelo/forward/x`;
		// The app (or a wrong status) says "revoked": Tunelo still knows the token.
		for (const status of [404, 200]) {
			await expect(
				checkMachineAnswer(
					ALICE,
					route,
					answer(at, "TUNELO_FORWARD_001", status),
				),
			).resolves.toBeUndefined();
		}
		expect((await TunnelLinkModel.findById(id).lean())?.deadAt).toBeUndefined();

		selfLinks.revoke(token);
		const error = await refusal(
			checkMachineAnswer(ALICE, route, answer(at, "TUNELO_FORWARD_001", 404)),
		);
		expect(error.code).toBe("MACHINE_LINK_REVOKED");
		const row = await TunnelLinkModel.findById(id).lean();
		expect(row?.deadAt).toBeInstanceOf(Date);
	});

	it("leave the app's own answers and other origins alone", async () => {
		const { id, token } = await ownMachine("tunelo.pc");
		const tunnel = new URL(fakeForwardUrl("tunelo.pc")).origin;
		const route = { machine: id, tunnel, token };
		await expect(
			checkMachineAnswer(ALICE, route, answer(`${tunnel}/x`, null, 502)),
		).resolves.toBeUndefined();
		await expect(
			checkMachineAnswer(
				ALICE,
				route,
				answer("https://elsewhere.example/", "TUNELO_FORWARD_003", 403),
			),
		).resolves.toBeUndefined();
	});
});
