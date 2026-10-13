import { describe, expect, test } from "vitest";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import { tuneloLoginCommand } from "../login-command.js";
import { runInTenant } from "../tunnel-tenant.js";

const ACME = {
	...TEST_TENANT,
	id: "t-acme",
	domain: "acme.test",
	tunnelDomain: "tunnel.acme.test",
};

describe("tuneloLoginCommand", () => {
	test("the primary tenant uses the CLI's default server", () => {
		expect(tuneloLoginCommand(TEST_TENANT)).toBe("tunelo login");
	});

	test("another tenant names its own server", () => {
		expect(runInTenant(ACME, () => tuneloLoginCommand())).toBe(
			"tunelo login --server https://tunnel.acme.test",
		);
	});
});
