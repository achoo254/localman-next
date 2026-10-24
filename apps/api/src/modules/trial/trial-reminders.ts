import { TRIAL_EXTENSION_GRACE_DAYS } from "@localman/shared";
import type { Logger } from "../../logger.js";
import { runInPrimaryTenant } from "../../tenancy/primary-tenant-job.js";
import { saigonDate } from "../../time/saigon-time.js";
import type { NotificationEvent } from "../notifications/notification-events.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import { UserModel } from "../users/user-model.js";
import { ACCOUNT_LINK } from "./trial-notices.js";
import { DAY_MS } from "./trial-state.js";

export const TRIAL_REMINDER_INTERVAL_MS = 60 * 60_000;
/** Users handled per run; the rest wait for the next one. */
const REMINDER_BATCH = 500;

/** Reminders of one trial end, each sent once (`users.trialNotices`). */
export type TrialMilestone = "ending7" | "ending1" | "ended";

/**
 * The reminder due `endsAt` at `now`: the end passed (`ended`, until the
 * extension grace is over), at most 1 day left, at most 7 days left.
 * Only the latest one is sent: a trial extended to end in 2 days skips
 * the 7-day reminder.
 */
export function dueMilestone(endsAt: Date, now: Date): TrialMilestone | null {
	const left = endsAt.getTime() - now.getTime();
	if (left <= 0) {
		return -left <= TRIAL_EXTENSION_GRACE_DAYS * DAY_MS ? "ended" : null;
	}
	if (left <= DAY_MS) return "ending1";
	if (left <= 7 * DAY_MS) return "ending7";
	return null;
}

function reminderOf(
	milestone: TrialMilestone,
	endsAt: Date,
	now: Date,
): NotificationEvent {
	const endsOn = saigonDate(endsAt);
	if (milestone === "ended") {
		return { type: "trial.ended", params: { endsOn }, link: ACCOUNT_LINK };
	}
	const daysLeft = Math.min(
		7,
		Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS)),
	);
	return {
		type: "trial.ending",
		params: { daysLeft, endsOn },
		link: ACCOUNT_LINK,
	};
}

interface TrialUserRow {
	sub: string;
	planExpiresAt: Date;
}

/**
 * Sends the due reminder of every trial ending within 7 days or ended
 * within the grace period. Each reminder is claimed on the user first
 * (`trialNotices.<milestone>` set to the end it is for, matched only when
 * it holds another end), so it goes out once per end even with several
 * processes; an extension moves the end and the reminders are due again.
 * A failed send releases its claim for the next run. Returns how many
 * were sent.
 */
export async function sendTrialReminders(
	logger: Logger,
	now: Date = new Date(),
): Promise<number> {
	const users = await UserModel.find({
		trialStartedAt: { $exists: true },
		plan: "pro",
		planExpiresAt: {
			$gte: new Date(now.getTime() - TRIAL_EXTENSION_GRACE_DAYS * DAY_MS),
			$lte: new Date(now.getTime() + 7 * DAY_MS),
		},
	})
		.select("sub planExpiresAt")
		.sort({ planExpiresAt: 1 })
		.limit(REMINDER_BATCH)
		.lean<TrialUserRow[]>();
	let sent = 0;
	for (const user of users) {
		const endsAt = user.planExpiresAt;
		const milestone = dueMilestone(endsAt, now);
		if (milestone === null) continue;
		const key = `trialNotices.${milestone}`;
		const { modifiedCount } = await UserModel.updateOne(
			{ sub: user.sub, planExpiresAt: endsAt, [key]: { $ne: endsAt } },
			{ $set: { [key]: endsAt } },
		);
		if (modifiedCount === 0) continue;
		try {
			await getNotificationService().notify(
				user.sub,
				reminderOf(milestone, endsAt, now),
			);
			sent += 1;
		} catch (error) {
			logger.error(
				{ err: error, sub: user.sub, milestone },
				"Trial reminder failed",
			);
			await UserModel.updateOne(
				{ sub: user.sub, [key]: endsAt },
				{ $unset: { [key]: 1 } },
			);
		}
	}
	return sent;
}

/**
 * Runs `sendTrialReminders` at start and then every hour (timer `unref`).
 * Runs never overlap; `stop` clears the timer and waits for a running one
 * (shutdown, before Mongo is disconnected).
 */
export class TrialReminderJob {
	private timer: NodeJS.Timeout | undefined;
	private running: Promise<void> | undefined;

	constructor(
		private readonly logger: Logger,
		private readonly intervalMs = TRIAL_REMINDER_INTERVAL_MS,
	) {}

	start(): void {
		if (this.timer) return;
		this.run();
		this.timer = setInterval(() => this.run(), this.intervalMs);
		this.timer.unref();
	}

	private run(): void {
		if (this.running) return;
		this.running = runInPrimaryTenant(this.logger, async () => {
			const sent = await sendTrialReminders(this.logger);
			if (sent > 0) this.logger.info({ sent }, "Trial reminders sent");
		})
			.then(
				() => undefined,
				(error: unknown) => {
					this.logger.error({ err: error }, "Trial reminder run failed");
				},
			)
			.finally(() => {
				this.running = undefined;
			});
	}

	async stop(): Promise<void> {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
		await this.running;
	}
}
