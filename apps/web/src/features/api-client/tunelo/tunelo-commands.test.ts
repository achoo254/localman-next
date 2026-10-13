import { describe, expect, it } from "vitest";
import { tuneloLoginCommand } from "./tunelo-commands";

describe("tuneloLoginCommand", () => {
	it("uses the CLI's default server for hoandat", () => {
		expect(tuneloLoginCommand("tunnel.hoandat.com")).toBe("tunelo login");
		expect(tuneloLoginCommand(null)).toBe("tunelo login");
	});

	it("names another domain's server", () => {
		expect(tuneloLoginCommand("tunnel.acme.test")).toBe(
			"tunelo login --server https://tunnel.acme.test",
		);
	});
});
