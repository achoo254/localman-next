import { describe, expect, it } from "vitest";
import { as, guest } from "../../test-support/dashboard-test-app.js";
import { FeedbackModel } from "./feedback-model.js";
import { TURNSTILE_TOKENS } from "./testing/fake-turnstile.js";
import {
	FORM,
	OWNER_CHAT,
	SUBMIT,
	useProInterestFixture,
} from "./testing/pro-interest-fixture.js";

const fx = useProInterestFixture();
const asGuest = (token: string, ip = "198.51.100.2") =>
	guest(ip).send("post", SUBMIT, { ...FORM, turnstileToken: token });

describe("POST /feedback/pro-interest", () => {
	it("stores a guest entry once Turnstile passes and alerts the owner with a masked email", async () => {
		const res = await asGuest(TURNSTILE_TOKENS.valid);
		expect(res.status).toBe(201);
		expect(res.body).toEqual({ received: true });
		expect(fx.turnstile.requests[0]).toMatchObject({
			secret: "secret-key",
			response: TURNSTILE_TOKENS.valid,
			remoteip: "198.51.100.2",
		});
		const stored = await FeedbackModel.findOne().lean();
		expect(stored).toMatchObject({
			type: "pro_interest",
			email: "nguyen.van@gmail.com",
			needs: ["mock", "team"],
			source: "landing",
			emailMatchesAccount: false,
		});
		expect(stored?.userSub).toBeUndefined();
		expect(stored?.consentAt).toBeInstanceOf(Date);
		expect(stored?.submissions).toHaveLength(1);

		const alerts = await fx.alerts();
		expect(alerts).toHaveLength(1);
		expect(fx.bot.requests[0]?.chat_id).toBe(OWNER_CHAT);
		const [text = ""] = alerts;
		for (const part of ["ng***@gm***.com", "mock, team", "2-5", "landing"]) {
			expect(text).toContain(part);
		}
		expect(text).not.toContain("nguyen.van@gmail.com");
		expect(text).not.toContain("Nguyễn");
	});

	it("blocks guests without a token, with a wrong one, one from another host or form, and when Cloudflare is down", async () => {
		const missing = await guest().send("post", SUBMIT, FORM);
		expect(missing.status).toBe(400);
		expect(missing.body.error.code).toBe("TURNSTILE_FAILED");
		const tokens = [
			"forged",
			TURNSTILE_TOKENS.otherHost,
			TURNSTILE_TOKENS.contact,
			TURNSTILE_TOKENS.noAction,
		];
		for (const [i, token] of tokens.entries()) {
			const res = await asGuest(token, `198.51.100.${10 + i}`);
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("TURNSTILE_FAILED");
		}
		fx.turnstile.failing = true;
		const down = await asGuest(TURNSTILE_TOKENS.valid, "198.51.100.20");
		expect(down.status).toBe(503);
		expect(down.body.error.code).toBe("TURNSTILE_UNAVAILABLE");
		expect(await FeedbackModel.countDocuments()).toBe(0);
	});

	it("needs no Turnstile when signed in and links the entry to the user", async () => {
		const res = await as("acc_signed").send("post", SUBMIT, FORM);
		expect(res.status).toBe(201);
		expect(fx.turnstile.requests).toHaveLength(0);
		expect((await FeedbackModel.findOne().lean())?.userSub).toBe("acc_signed");
	});

	it("refuses a submission without consent", async () => {
		const { consent: _consent, ...withoutConsent } = FORM;
		for (const body of [withoutConsent, { ...FORM, consent: false }]) {
			const res = await as("acc_signed").send("post", SUBMIT, body);
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
		}
		expect(await FeedbackModel.countDocuments()).toBe(0);
	});

	it("stores an unknown source as other", async () => {
		await as("acc_signed").send("post", SUBMIT, {
			...FORM,
			source: "newsletter",
		});
		expect((await FeedbackModel.findOne().lean())?.source).toBe("other");
	});

	it("answers a filled honeypot like a success but stores and sends nothing", async () => {
		const res = await guest().send("post", SUBMIT, {
			...FORM,
			website: "http://spam.example",
		});
		expect(res.status).toBe(201);
		expect(res.body).toEqual({ received: true });
		expect(await FeedbackModel.countDocuments()).toBe(0);
		expect(await fx.alerts()).toHaveLength(0);
	});

	it("publishes the Turnstile site key", async () => {
		const res = await guest().get("/feedback/pro-interest/config");
		expect(res.body).toEqual({ turnstileSiteKey: "site-key" });
	});
});
