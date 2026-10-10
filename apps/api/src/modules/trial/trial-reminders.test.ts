import { describe, expect, it } from "vitest";
import { createLogger } from "../../logger.js";
import { NotificationModel } from "../notifications/notification-model.js";
import { UserModel } from "../users/user-model.js";
import { DAY_MS, USER, useTrialFixture } from "./testing/trial-fixture.js";
import { TrialReminderJob, sendTrialReminders } from "./trial-reminders.js";

const fx = useTrialFixture();
const logger = createLogger("silent");
const END = new Date("2026-11-09T16:59:59.999Z");
const HOUR = 3_600_000;
const endMinus = (ms: number, end = END) => new Date(end.getTime() - ms);

async function startTrialEnding(end: Date): Promise<void> {
	await UserModel.updateOne(
		{ sub: USER },
		{
			$set: {
				plan: "pro",
				planExpiresAt: end,
				trialStartedAt: new Date(end.getTime() - 30 * DAY_MS),
			},
		},
	);
}

/** Runs the job hourly from `from` to `to` (fake clock). */
async function runHourly(from: Date, to: Date): Promise<number> {
	let sent = 0;
	for (let at = from.getTime(); at <= to.getTime(); at += HOUR) {
		sent += await sendTrialReminders(logger, new Date(at));
	}
	return sent;
}

async function reminders(): Promise<{ type: string; params: unknown }[]> {
	await fx.notificationTypes(USER);
	return NotificationModel.find({ userSub: USER })
		.sort({ _id: 1 })
		.select("-_id type params")
		.lean<{ type: string; params: unknown }[]>();
}

describe("trial reminders", () => {
	it("sends 7 days, 1 day and ended once each over the trial's last week", async () => {
		await startTrialEnding(END);
		const sent = await runHourly(
			endMinus(9 * DAY_MS),
			new Date(END.getTime() + 3 * DAY_MS),
		);
		expect(sent).toBe(3);
		expect(await reminders()).toEqual([
			{ type: "trial.ending", params: { daysLeft: 7, endsOn: "2026-11-09" } },
			{ type: "trial.ending", params: { daysLeft: 1, endsOn: "2026-11-09" } },
			{ type: "trial.ended", params: { endsOn: "2026-11-09" } },
		]);
	});

	it("sends again for the new end after an extension", async () => {
		await startTrialEnding(END);
		await runHourly(endMinus(2 * DAY_MS), new Date(END.getTime() + HOUR));
		expect((await reminders()).map((r) => r.type)).toEqual([
			"trial.ending",
			"trial.ending",
			"trial.ended",
		]);
		const extended = new Date(END.getTime() + 30 * DAY_MS);
		await UserModel.updateOne(
			{ sub: USER },
			{ $set: { planExpiresAt: extended } },
		);
		const sent = await runHourly(
			new Date(END.getTime() + 2 * HOUR),
			new Date(extended.getTime() + HOUR),
		);
		expect(sent).toBe(3);
		const types = (await reminders()).map((r) => r.type);
		expect(types).toEqual([
			"trial.ending",
			"trial.ending",
			"trial.ended",
			"trial.ending",
			"trial.ending",
			"trial.ended",
		]);
	});

	it("skips users without a trial and trials ended long ago", async () => {
		await UserModel.updateOne(
			{ sub: USER },
			{ $set: { plan: "pro", planExpiresAt: END } },
		);
		expect(await sendTrialReminders(logger, endMinus(HOUR))).toBe(0);
		await startTrialEnding(END);
		expect(
			await sendTrialReminders(logger, new Date(END.getTime() + 8 * DAY_MS)),
		).toBe(0);
		expect(await reminders()).toEqual([]);
	});

	it("sends each reminder once when two runs race", async () => {
		await startTrialEnding(END);
		const at = endMinus(3 * DAY_MS);
		const sent = await Promise.all([
			sendTrialReminders(logger, at),
			sendTrialReminders(logger, at),
		]);
		expect(sent[0] + sent[1]).toBe(1);
	});

	it("runs at start and stops cleanly", async () => {
		const soon = new Date(Date.now() + 3 * DAY_MS);
		await startTrialEnding(soon);
		const job = new TrialReminderJob(logger, 60_000);
		job.start();
		await job.stop();
		expect((await reminders()).map((r) => r.type)).toEqual(["trial.ending"]);
	});
});
