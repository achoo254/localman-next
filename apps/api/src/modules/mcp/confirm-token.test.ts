import { OperationError } from "@localman/operations";
import { describe, expect, it } from "vitest";
import {
	CONFIRM_TOKEN_TTL_MS,
	type ConfirmTokenBinding,
	canonicalJson,
	createConfirmTokenService,
} from "./confirm-token.js";

const binding: ConfirmTokenBinding = {
	subjectId: "user-1",
	tool: "delete_project",
	input: { projectId: "p1", options: { b: 1, a: [2, 1] } },
};

function codeOf(run: () => void): string | undefined {
	try {
		run();
		return undefined;
	} catch (error) {
		if (error instanceof OperationError) return error.code;
		throw error;
	}
}

describe("canonicalJson", () => {
	it("sorts keys at every level and keeps array order", () => {
		expect(canonicalJson({ b: { y: 1, x: 2 }, a: [3, 1] })).toBe(
			'{"a":[3,1],"b":{"x":2,"y":1}}',
		);
		expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
	});
});

describe("createConfirmTokenService", () => {
	it("accepts a token once for the binding it was issued for", () => {
		const service = createConfirmTokenService();
		const { token, expiresAt } = service.issue(binding);
		expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
		const reordered = {
			...binding,
			input: { options: { a: [2, 1], b: 1 }, projectId: "p1" },
		};
		expect(codeOf(() => service.consume(token, reordered))).toBeUndefined();
		expect(codeOf(() => service.consume(token, binding))).toBe(
			"CONFIRM_TOKEN_USED",
		);
	});

	it("requires a token", () => {
		const service = createConfirmTokenService();
		expect(codeOf(() => service.consume(undefined, binding))).toBe(
			"CONFIRMATION_REQUIRED",
		);
		expect(codeOf(() => service.consume("", binding))).toBe(
			"CONFIRMATION_REQUIRED",
		);
	});

	it("rejects another user, tool or input, and tampered tokens", () => {
		const service = createConfirmTokenService();
		const { token } = service.issue(binding);
		const variants: ConfirmTokenBinding[] = [
			{ ...binding, subjectId: "user-2" },
			{ ...binding, tool: "reset_all_resource_data" },
			{ ...binding, input: { projectId: "p2" } },
		];
		for (const other of variants) {
			expect(codeOf(() => service.consume(token, other))).toBe(
				"CONFIRM_TOKEN_INVALID",
			);
		}
		const [version, expires, nonce, signature] = token.split(".");
		const later = (Number.parseInt(expires ?? "", 36) + 60_000).toString(36);
		for (const forged of [
			`${version}.${later}.${nonce}.${signature}`,
			`${token}x`,
			"v1.abc",
			`${token}.extra`,
		]) {
			expect(codeOf(() => service.consume(forged, binding))).toBe(
				"CONFIRM_TOKEN_INVALID",
			);
		}
		// Failed attempts do not consume the genuine token.
		expect(codeOf(() => service.consume(token, binding))).toBeUndefined();
	});

	it("rejects a token signed with another secret", () => {
		const issuer = createConfirmTokenService();
		const verifier = createConfirmTokenService();
		const { token } = issuer.issue(binding);
		expect(codeOf(() => verifier.consume(token, binding))).toBe(
			"CONFIRM_TOKEN_INVALID",
		);
	});

	it("expires after the TTL", () => {
		let now = 5_000_000;
		const service = createConfirmTokenService({ now: () => now });
		const { token } = service.issue(binding);
		now += CONFIRM_TOKEN_TTL_MS - 1;
		const second = service.issue(binding).token;
		now += 1;
		expect(codeOf(() => service.consume(token, binding))).toBe(
			"CONFIRM_TOKEN_EXPIRED",
		);
		expect(codeOf(() => service.consume(second, binding))).toBeUndefined();
	});

	it("refuses a short secret", () => {
		expect(() =>
			createConfirmTokenService({ secret: new Uint8Array(16) }),
		).toThrow(/at least 32 bytes/);
	});
});
