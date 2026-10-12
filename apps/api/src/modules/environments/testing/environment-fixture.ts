import { randomBytes } from "node:crypto";
import type { EnvironmentDetail } from "@localman/shared/api-client";
import { afterEach, beforeEach, expect } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../../config/runtime-settings.js";
import { as } from "../../../test-support/dashboard-test-app.js";
import { useAccessTestDb } from "../../access/testing/access-fixture.js";
import { parseKeyring } from "../../auth/token-cipher.js";
import { registerEnvironmentAdapter } from "../environment-access.js";

/** A fresh keyring for secret variables, as `VARIABLE_ENCRYPTION_KEY` holds. */
export function testKeyring(kid = "k1") {
	return parseKeyring(`${kid}:${randomBytes(32).toString("base64")}`);
}

/** TEST ONLY. Installs a keyring (or none) for secret variables. */
export function useVariableKeyring(
	keyring: ReturnType<typeof testKeyring>,
): void {
	configureRuntime({ ...DEFAULT_RUNTIME_SETTINGS, variableKeyring: keyring });
}

/**
 * TEST ONLY. The access test database (users Ada, Eve, Vic, Ollie, Una)
 * with the real environment adapter and a keyring for secret variables.
 */
export function useEnvironmentTestDb(): void {
	useAccessTestDb();
	beforeEach(() => {
		registerEnvironmentAdapter();
		useVariableKeyring(testKeyring());
	});
	afterEach(() => configureRuntime(DEFAULT_RUNTIME_SETTINGS));
}

/** Creates an environment as `sub` (expects 201) and returns it. */
export async function createEnvironmentAs(
	sub: string,
	workspaceId: string,
	body: object = { name: "Staging" },
): Promise<EnvironmentDetail> {
	const res = await as(sub).send(
		"post",
		`/workspaces/${workspaceId}/environments`,
		body,
	);
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return res.body as EnvironmentDetail;
}

/** Shorthand of a variable as an Editor writes it. */
export const variableInput = (
	key: string,
	sharedValue: string | null,
	extra: object = {},
) => ({ key, sharedValue, ...extra });
