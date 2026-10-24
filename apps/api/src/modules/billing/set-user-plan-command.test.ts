import { describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import {
	UsageError,
	parseSetUserPlanArgs,
	setUserPlan,
} from "./set-user-plan-command.js";

useDashboardTestDb();

describe("parseSetUserPlanArgs", () => {
	it("reads a Pro plan with an inclusive Saigon expiry", () => {
		expect(
			parseSetUserPlanArgs([
				"--username",
				"dat",
				"--plan",
				"pro",
				"--expires",
				"2026-12-31",
			]),
		).toEqual({
			user: { username: "dat" },
			plan: "pro",
			expiresAt: new Date("2026-12-31T16:59:59.999Z"),
		});
		expect(parseSetUserPlanArgs(["--sub", "acc_1", "--plan", "free"])).toEqual({
			user: { sub: "acc_1" },
			plan: "free",
			expiresAt: null,
		});
	});

	it("refuses a past expiry unless forced", () => {
		const now = new Date("2026-10-09T00:00:00Z");
		const past = ["--sub", "a", "--plan", "pro", "--expires", "2026-10-01"];
		expect(() => parseSetUserPlanArgs(past, now)).toThrow(/--force/);
		expect(parseSetUserPlanArgs([...past, "--force"], now).expiresAt).toEqual(
			new Date("2026-10-01T16:59:59.999Z"),
		);
		// Today still counts until the end of the Saigon day.
		const today = ["--sub", "a", "--plan", "pro", "--expires", "2026-10-09"];
		expect(parseSetUserPlanArgs(today, now).plan).toBe("pro");
	});

	it.each([
		[["--plan", "pro"]],
		[["--sub", "a", "--username", "b", "--plan", "pro"]],
		[["--sub", "a", "--plan", "gold"]],
		[["--sub", "a", "--plan", "free", "--expires", "2026-12-31"]],
		[["--sub", "a", "--plan", "pro", "--expires", "2026-02-30"]],
		[["--sub", "a", "--plan", "pro", "--bogus"]],
	])("refuses %j", (argv) => {
		expect(() => parseSetUserPlanArgs(argv)).toThrow(UsageError);
	});
});

describe("setUserPlan", () => {
	it("sets and clears the plan and expiry without exposing the email", async () => {
		await UserModel.create({
			sub: "acc_1",
			username: "dat",
			email: "dat@example.com",
		});
		const expiresAt = new Date("2026-12-31T16:59:59.999Z");
		const pro = await setUserPlan({
			user: { username: "dat" },
			plan: "pro",
			expiresAt,
		});
		expect(pro).toEqual({
			sub: "acc_1",
			username: "dat",
			plan: "pro",
			planExpiresAt: expiresAt.toISOString(),
		});
		const free = await setUserPlan({
			user: { sub: "acc_1" },
			plan: "free",
			expiresAt: null,
		});
		expect(free.planExpiresAt).toBeNull();
		expect(
			(await UserModel.findOne({ sub: "acc_1" }).lean())?.planExpiresAt,
		).toBeUndefined();
	});

	it("refuses unknown and ambiguous users", async () => {
		await expect(
			setUserPlan({
				user: { sub: "nobody" },
				plan: "pro",
				expiresAt: null,
			}),
		).rejects.toThrow(/No user/);
		await UserModel.create([
			{ sub: "acc_a", username: "twin" },
			{ sub: "acc_b", username: "twin" },
		]);
		await expect(
			setUserPlan({
				user: { username: "twin" },
				plan: "pro",
				expiresAt: null,
			}),
		).rejects.toThrow(/use --sub/);
	});
});
