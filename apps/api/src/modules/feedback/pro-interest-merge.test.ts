import { beforeEach, describe, expect, it } from "vitest";
import { as, guest } from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { FeedbackModel, SUBMISSION_HISTORY_MAX } from "./feedback-model.js";
import { TURNSTILE_TOKENS } from "./testing/fake-turnstile.js";
import {
	FORM,
	SUBMIT,
	useProInterestFixture,
} from "./testing/pro-interest-fixture.js";

const fx = useProInterestFixture(() => ({
	feedbackRateLimit: {
		perIp: { max: 100, windowMs: 60_000 },
		perUser: { max: 100, windowMs: 60_000 },
	},
}));
const OWNER = "acc_owner_of_email";
const STRANGER = "acc_stranger";
const EMAIL = "nguyen.van@gmail.com";

beforeEach(async () => {
	await UserModel.create([
		{ sub: OWNER, username: "nguyen", email: EMAIL, emailVerified: true },
		{
			sub: STRANGER,
			username: "stranger",
			email: "x@y.z",
			emailVerified: true,
		},
		{
			sub: "acc_unverified",
			username: "u",
			email: EMAIL,
			emailVerified: false,
		},
	]);
});

const submitAs = (sub: string | null, extra: object = {}) =>
	(sub === null ? guest() : as(sub)).send("post", SUBMIT, {
		...FORM,
		turnstileToken: TURNSTILE_TOKENS.valid,
		...extra,
	});
const entry = async () => FeedbackModel.findOne({ email: EMAIL }).lean();
/** Alert headlines, sorted: background sends may arrive in any order. */
const headlines = async () =>
	(await fx.alerts()).map((t) => t.split("\n")[0]).sort();

describe("merging Pro interest by email", () => {
	it("flags an email the signed-in sender verified at the IdP", async () => {
		await submitAs(OWNER);
		expect((await entry())?.emailMatchesAccount).toBe(true);
		await FeedbackModel.deleteMany({});
		await submitAs("acc_unverified");
		expect((await entry())?.emailMatchesAccount).toBe(false);
	});

	it("lets the linked account update its entry, keeping createdAt", async () => {
		await submitAs(OWNER, { note: "first", priceHint: "5$" });
		const first = await entry();
		await submitAs(OWNER, { needs: ["mcp"], teamSize: ">20" });
		const updated = await entry();
		expect(updated).toMatchObject({
			needs: ["mcp"],
			teamSize: ">20",
			userSub: OWNER,
		});
		expect(updated?.note).toBeUndefined();
		expect(updated?.priceHint).toBeUndefined();
		expect(updated?.createdAt).toEqual(first?.createdAt);
		expect(await FeedbackModel.countDocuments()).toBe(1);
		expect(await headlines()).toEqual([
			"Quan tâm gói Pro: cập nhật",
			"Quan tâm gói Pro: đăng ký mới",
		]);
	});

	it("never lets a guest or another account replace a linked entry; it only joins the history", async () => {
		await submitAs(OWNER, { note: "mine" });
		const before = await entry();
		await submitAs(null, { name: "Kẻ giả", needs: ["tunelo"], note: "" });
		await submitAs(STRANGER, { name: "Người lạ", teamSize: "1" });
		const after = await entry();
		expect(after).toMatchObject({
			userSub: OWNER,
			name: FORM.name,
			needs: FORM.needs,
			teamSize: FORM.teamSize,
			note: "mine",
			emailMatchesAccount: true,
		});
		expect(after?.consentAt).toEqual(before?.consentAt);
		expect(
			after?.submissions?.map((s) => [s.name, s.applied, s.userSub ?? null]),
		).toEqual([
			[FORM.name, true, OWNER],
			["Kẻ giả", false, null],
			["Người lạ", false, STRANGER],
		]);
		expect(await headlines()).toEqual([
			"Quan tâm gói Pro: gửi lại từ người khác (chỉ lưu lịch sử)",
			"Quan tâm gói Pro: gửi lại từ người khác (chỉ lưu lịch sử)",
			"Quan tâm gói Pro: đăng ký mới",
		]);
	});

	it("lets guests overwrite an unlinked entry, and a verified owner claim it, but not an unverified account", async () => {
		await submitAs(null, { teamSize: "1" });
		await submitAs(null, { teamSize: "6-20" });
		expect((await entry())?.teamSize).toBe("6-20");
		await submitAs("acc_unverified", { teamSize: ">20" });
		expect(await entry()).toMatchObject({ teamSize: "6-20" });
		expect((await entry())?.userSub).toBeUndefined();
		await submitAs(OWNER, { teamSize: "2-5" });
		expect(await entry()).toMatchObject({
			teamSize: "2-5",
			userSub: OWNER,
			emailMatchesAccount: true,
		});
	});

	it("keeps only the most recent submissions", async () => {
		for (let i = 0; i < SUBMISSION_HISTORY_MAX + 3; i += 1) {
			await submitAs(OWNER, { note: `n${i}` });
		}
		const history = (await entry())?.submissions ?? [];
		expect(history).toHaveLength(SUBMISSION_HISTORY_MAX);
		expect(history.at(-1)?.note).toBe(`n${SUBMISSION_HISTORY_MAX + 2}`);
	});
});
