import { describe, expect, it } from "vitest";
import { guest } from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { alertOwnerThrottled } from "./owner-alert-throttle.js";
import { TURNSTILE_TOKENS } from "./testing/fake-turnstile.js";
import { OWNER_CHAT, useFeedbackFixture } from "./testing/feedback-fixture.js";

const OWNER_A = "acc_owner_a";
const OWNER_B = "acc_owner_b";

const fx = useFeedbackFixture(() => ({
	ownerSubs: new Set([OWNER_A, OWNER_B]),
	ownerAlertLimit: { max: 1, windowMs: 60_000 },
}));

const contact = (message: string) =>
	guest().send("post", "/feedback/contact", {
		turnstileToken: TURNSTILE_TOKENS.contact,
		category: "feedback",
		message,
		source: "landing",
	});

describe("owner alerts in the owner's language", () => {
	it("are in English while no owner chose a language", async () => {
		await UserModel.create({ sub: OWNER_A, username: "a" });
		expect((await contact("Xem https://evil.example")).status).toBe(201);
		expect(await fx.alerts()).toEqual([
			[
				"New feedback / contact: Feedback",
				"Message: Xem hxxps://evil[.]example",
				"Contact: not provided",
				"Sender: guest",
				"Source: landing",
			].join("\n"),
		]);
	});

	it("follow the user whose Telegram chat is the owner chat, word for word in Vietnamese", async () => {
		await UserModel.create([
			{ sub: OWNER_A, username: "a", locale: "zh-CN" },
			{
				sub: "acc_chat_owner",
				username: "c",
				locale: "vi",
				telegram: { chatId: OWNER_CHAT },
			},
		]);
		await contact("Nút Lưu lỗi");
		expect(await fx.alerts()).toEqual([
			[
				"Góp ý / Liên hệ mới: Góp ý",
				"Nội dung: Nút Lưu lỗi",
				"Liên hệ: không để lại",
				"Người gửi: khách",
				"Nguồn: landing",
			].join("\n"),
		]);
	});

	it("else follow the first owner in OWNER_SUBS who chose a language", async () => {
		await UserModel.create([
			{ sub: OWNER_B, username: "b", locale: "vi" },
			{ sub: OWNER_A, username: "a", locale: "zh-CN" },
		]);
		expect((await contact("保存按钮没反应")).status).toBe(201);
		const [text = ""] = await fx.alerts();
		expect(text.split("\n")).toEqual([
			"新的反馈 / 联系：反馈",
			"内容：保存按钮没反应",
			"联系方式：未留下",
			"发送者：访客",
			"来源：landing",
		]);
	});

	it("summarize suppressed alerts in the owner's language", async () => {
		await UserModel.create({ sub: OWNER_A, username: "a", locale: "vi" });
		const start = new Date("2026-10-09T03:00:00Z");
		await alertOwnerThrottled("test.kind", () => "first", start);
		await alertOwnerThrottled("test.kind", () => "skipped", start);
		const next = new Date(start.getTime() + 60_000);
		await alertOwnerThrottled("test.kind", () => "next", next);
		expect((await fx.alerts()).sort()).toEqual([
			"first",
			"next\n\n(và 1 lượt khác chưa báo vì vượt giới hạn tin báo)",
		]);
	});
});
