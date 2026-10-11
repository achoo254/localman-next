import { describe, expect, it } from "vitest";
import { initialOf } from "./initial";

describe("initialOf", () => {
	it("takes the first whole character, in upper case", () => {
		expect(initialOf("minh anh")).toBe("M");
		expect(initialOf("  ước")).toBe("Ư");
		// Decomposed accent: letter and mark stay together.
		expect(initialOf("élise")).toBe("É");
		expect(initialOf("👩🏽‍💻 Lan")).toBe("👩🏽‍💻");
		expect(initialOf("李雷")).toBe("李");
	});

	it("shows a question mark without a name", () => {
		expect(initialOf(null)).toBe("?");
		expect(initialOf("   ")).toBe("?");
	});
});
