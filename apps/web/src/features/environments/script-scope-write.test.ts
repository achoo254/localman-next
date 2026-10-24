import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalValueWrite } from "./local-values-api";
import { type ScriptScope, writeScriptScope } from "./script-scope-write";

const vault = vi.hoisted(() => ({ open: [] as string[] }));

vi.mock("../secure-vault/vault-codec", async (importOriginal) => ({
	...(await importOriginal<typeof import("../secure-vault/vault-codec")>()),
	openVaultValues: () => vault.open,
}));
vi.mock("../secure-vault/vault-session", async (importOriginal) => ({
	...(await importOriginal<typeof import("../secure-vault/vault-session")>()),
	loadVault: async () => ({ status: "off" }),
}));

function scopeWith(written: LocalValueWrite[][]): ScriptScope {
	return {
		agentTarget: { kind: "environment", id: "e1" },
		load: async () => ({
			variables: [
				{ key: "token", type: "secret" },
				{ key: "auth", type: "default" },
				{ key: "page", type: "default" },
			],
			localValues: [],
		}),
		write: async (values) => {
			written.push(values);
		},
	};
}

describe("script writes and the vault", () => {
	beforeEach(() => {
		vault.open = [];
	});

	it("keep a vault value out of a variable that is not a secret", async () => {
		vault.open = ["vault-token-value"];
		const written: LocalValueWrite[][] = [];
		const result = await writeScriptScope(
			new QueryClient(),
			scopeWith(written),
			[
				{ key: "auth", value: "Bearer vault-token-value" },
				{ key: "page", value: "2" },
				{ key: "token", value: "vault-token-value" },
			],
		);
		expect(result).toEqual({ saved: true, withheld: ["auth"] });
		expect(written[0]?.map(({ key }) => key)).toEqual(["page", "token"]);
	});

	it("write everything while no vault value is open", async () => {
		const written: LocalValueWrite[][] = [];
		const result = await writeScriptScope(
			new QueryClient(),
			scopeWith(written),
			[{ key: "auth", value: "Bearer vault-token-value" }],
		);
		expect(result).toEqual({ saved: true, withheld: [] });
		expect(written).toHaveLength(1);
	});
});
