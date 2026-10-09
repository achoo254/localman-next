import { describe, expect, it } from "vitest";
import { as, guest } from "../../test-support/dashboard-test-app.js";
import { ContactMessageModel } from "./contact-message-model.js";
import { FeedbackModel } from "./feedback-model.js";
import { TURNSTILE_TOKENS } from "./testing/fake-turnstile.js";
import {
	OWNER_CHAT,
	FORM as PRO_FORM,
	SUBMIT as PRO_SUBMIT,
	useProInterestFixture,
} from "./testing/pro-interest-fixture.js";

const SUBMIT = "/feedback/contact";
const MESSAGE = {
	category: "bug",
	message: "Nút Lưu không phản hồi\nkhi schema có 20 field",
	name: "Lan",
	contact: "Lan.Nguyen@Gmail.com",
	source: "projects",
};

const fx = useProInterestFixture(() => ({
	feedbackRateLimit: {
		perIp: { max: 3, windowMs: 60_000 },
		perUser: { max: 2, windowMs: 60_000 },
	},
	ownerAlertLimit: { max: 2, windowMs: 60_000 },
}));

const asGuest = (body: object, ip = "198.51.100.2") =>
	guest(ip).send("post", SUBMIT, {
		turnstileToken: TURNSTILE_TOKENS.contact,
		...body,
	});

describe("POST /feedback/contact", () => {
	it("stores a guest message after Turnstile and alerts the owner with an excerpt", async () => {
		const res = await asGuest(MESSAGE);
		expect(res.status).toBe(201);
		expect(res.body).toEqual({ received: true });
		expect(fx.turnstile.requests[0]).toMatchObject({
			response: TURNSTILE_TOKENS.contact,
			remoteip: "198.51.100.2",
		});
		const stored = await ContactMessageModel.findOne({
			type: "contact",
		}).lean();
		expect(stored).toMatchObject({
			category: "bug",
			message: MESSAGE.message,
			name: "Lan",
			contact: "lan.nguyen@gmail.com",
			contactKind: "email",
			source: "projects",
			status: "new",
		});
		expect(stored?.userSub).toBeUndefined();

		const alerts = await fx.alerts();
		expect(alerts).toHaveLength(1);
		expect(fx.bot.requests[0]?.chat_id).toBe(OWNER_CHAT);
		const [text = ""] = alerts;
		expect(text).toContain("New feedback / contact: Bug report");
		expect(text).toContain(
			"Message: Nút Lưu không phản hồi khi schema có 20 field",
		);
		expect(text).toContain("Contact: email la***@gm***.com");
		expect(text).toContain("Source: projects");
		expect(text).not.toContain("lan.nguyen@gmail.com");
		expect(text).not.toContain("Lan\n");
	});

	it("links a signed-in sender, skips Turnstile and keeps a Telegram username", async () => {
		const res = await as("acc_signed").send("post", SUBMIT, {
			message: "Cho thêm export Postman",
			contact: "@lan_dev",
			name: "  ",
			source: "/invite/secret-token",
		});
		expect(res.status).toBe(201);
		expect(fx.turnstile.requests).toHaveLength(0);
		const stored = await ContactMessageModel.findOne().lean();
		expect(stored).toMatchObject({
			userSub: "acc_signed",
			category: "feedback",
			contact: "@lan_dev",
			contactKind: "telegram",
			source: "other",
		});
		expect(stored?.name).toBeUndefined();
		const [text = ""] = await fx.alerts();
		expect(text).toContain("Telegram @la***");
		expect(text).toContain("Sender: signed in");
	});

	it("rejects an empty or too long message and an unusable reply address", async () => {
		const bodies = [
			{ message: "   " },
			{ message: "x".repeat(2001) },
			{ message: "ok", contact: "not an address" },
			{ message: "ok", name: "n".repeat(101) },
		];
		for (const body of bodies) {
			const res = await as("acc_valid").send("post", SUBMIT, body);
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
		}
		expect(await ContactMessageModel.countDocuments()).toBe(0);
	});

	it("blocks guests without a token solved on the contact form", async () => {
		const missing = await guest().send("post", SUBMIT, MESSAGE);
		expect(missing.body.error.code).toBe("TURNSTILE_FAILED");
		const tokens = [
			"forged",
			// Solved on the Pro interest form, or by a widget without action.
			TURNSTILE_TOKENS.valid,
			TURNSTILE_TOKENS.noAction,
		];
		for (const [i, token] of tokens.entries()) {
			const res = await asGuest(
				{ ...MESSAGE, turnstileToken: token },
				`198.51.100.${30 + i}`,
			);
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("TURNSTILE_FAILED");
		}
		expect(await ContactMessageModel.countDocuments()).toBe(0);
	});

	it("answers a filled honeypot like a success but stores and sends nothing", async () => {
		const res = await asGuest({ ...MESSAGE, website: "http://spam.example" });
		expect(res.status).toBe(201);
		expect(res.body).toEqual({ received: true });
		expect(await ContactMessageModel.countDocuments()).toBe(0);
		expect(await fx.alerts()).toHaveLength(0);
	});

	it("rate-limits per IP (honeypot hits count) and per account, apart from the Pro form", async () => {
		const ip = "203.0.113.7";
		expect((await asGuest({ ...MESSAGE, website: "x" }, ip)).status).toBe(201);
		for (let i = 0; i < 2; i += 1)
			expect((await asGuest(MESSAGE, ip)).status).toBe(201);
		const limited = await asGuest(MESSAGE, ip);
		expect(limited.status).toBe(429);
		expect(limited.body.error.code).toBe("RATE_LIMITED");
		const pro = await guest(ip).send("post", PRO_SUBMIT, {
			...PRO_FORM,
			turnstileToken: TURNSTILE_TOKENS.valid,
		});
		expect(pro.status).toBe(201);

		const send = (n: number) =>
			as("acc_roaming", `198.51.100.${50 + n}`).send("post", SUBMIT, MESSAGE);
		expect((await send(1)).status).toBe(201);
		expect((await send(2)).status).toBe(201);
		expect((await send(3)).status).toBe(429);
	});

	it("throttles owner alerts per kind while storing every message", async () => {
		for (let i = 0; i < 3; i += 1) {
			expect((await asGuest(MESSAGE, `198.51.100.${60 + i}`)).status).toBe(201);
		}
		expect(await ContactMessageModel.countDocuments()).toBe(3);
		expect(await fx.alerts()).toHaveLength(2);
	});

	it("keeps contact messages out of the Pro interest model", async () => {
		await asGuest(MESSAGE);
		expect(await FeedbackModel.countDocuments({ type: "pro_interest" })).toBe(
			0,
		);
		expect(await ContactMessageModel.countDocuments({ type: "contact" })).toBe(
			1,
		);
	});
});
