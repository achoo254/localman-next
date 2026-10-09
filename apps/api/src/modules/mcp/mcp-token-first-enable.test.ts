import { afterEach, describe, expect, it, vi } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import {
	OWNER,
	createMockProject,
	useMockTestKit,
} from "../mock-runtime/testing/mock-test-kit.js";
import { McpTokenModel, tokenMatches } from "./mcp-token-model.js";

useMockTestKit();
afterEach(() => vi.restoreAllMocks());

/** Resolves once `count` callers called the returned function. */
function barrier(count: number): [Promise<void>, () => void] {
	let arrived = 0;
	let open = (): void => undefined;
	const all = new Promise<void>((resolve) => {
		open = resolve;
	});
	const arrive = () => {
		arrived += 1;
		if (arrived >= count) open();
	};
	return [all, arrive];
}

/**
 * Holds every "turn the existing token on" lookup until `count` of them
 * ran, so that many requests all find no token before any stores one.
 */
function holdTokenLookups(count: number): void {
	const [allRead, arrive] = barrier(count);
	const findOneAndUpdate = McpTokenModel.findOneAndUpdate.bind(McpTokenModel);
	vi.spyOn(McpTokenModel, "findOneAndUpdate").mockImplementation(((
		...args: Parameters<typeof findOneAndUpdate>
	) => {
		const query = findOneAndUpdate(...args);
		if (!JSON.stringify(args[0]).includes('"$ne":null')) return query;
		arrive();
		return {
			lean: async () => {
				const found = await query.lean();
				await allRead;
				return found;
			},
		};
	}) as unknown as typeof findOneAndUpdate);
}

describe("first MCP token", () => {
	it("is issued exactly once when first enables race", async () => {
		const { id } = await createMockProject();
		holdTokenLookups(2);
		const enable = () =>
			as(OWNER).send("put", `/projects/${id}/mcp-token`, { required: true });
		const results = await Promise.all([enable(), enable()]);
		expect(results.map((res) => res.status)).toEqual([200, 200]);
		expect(results.every((res) => res.body.required === true)).toBe(true);
		const issued = results.flatMap((res) =>
			typeof res.body.issuedToken === "string" ? [res.body.issuedToken] : [],
		);
		expect(issued).toHaveLength(1);
		// The token shown is the one stored: it authenticates.
		const stored = await McpTokenModel.findOne().lean();
		expect(issued[0] && stored?.tokenHash).toBeTruthy();
		expect(tokenMatches(issued[0] ?? "", stored?.tokenHash ?? "")).toBe(true);
	});
});
