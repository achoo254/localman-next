import { ClientSettingsModel } from "../../api-client/client-settings-model.js";
import { DraftModel } from "../../api-client/draft-model.js";
import { HistoryModel } from "../../api-client/history-model.js";
import { AuditEventModel } from "../../audit/audit-event-model.js";
import { MobileHandoffModel } from "../../auth/mobile-handoff-model.js";
import { SessionModel } from "../../auth/session-model.js";
import { UsageCounterModel } from "../../billing/usage-counter-model.js";
import { ContactMessageModel } from "../../feedback/contact-message-model.js";
import { FeedbackModel } from "../../feedback/feedback-model.js";
import { NotificationModel } from "../../notifications/notification-model.js";
import { NotificationPreferencesModel } from "../../notifications/notification-preferences-model.js";
import { PushSubscriptionModel } from "../../notifications/push-subscription-model.js";
import { TrialExtensionModel } from "../../trial/trial-extension-model.js";
import type { OwnRow } from "./own-rows-fixture.js";

/** TEST ONLY. Identity, settings and personal history rows. */
export const PERSONAL_ROWS: readonly OwnRow[] = [
	[
		"sessions",
		(sub) =>
			SessionModel.create({
				_id: `session-${sub}`,
				sub,
				tokens: "sealed",
				accessTokenExpiresAt: new Date(),
				expiresAt: new Date(Date.now() + 60_000),
			}),
		(sub) => SessionModel.countDocuments({ sub }),
	],
	[
		"mobile_handoffs",
		(sub) =>
			MobileHandoffModel.create({
				_id: `handoff-${sub}`,
				sub,
				tokens: "sealed",
				accessTokenExpiresAt: new Date(),
				codeChallenge: "c".repeat(43),
				appState: "s".repeat(22),
				expiresAt: new Date(Date.now() + 60_000),
			}),
		(sub) => MobileHandoffModel.countDocuments({ sub }),
	],
	[
		"push_subscriptions",
		(sub) =>
			PushSubscriptionModel.create({
				userSub: sub,
				sessionId: `session-${sub}`,
				endpoint: `https://push.test/${sub}`,
				keys: { p256dh: "p", auth: "a" },
			}),
		(sub) => PushSubscriptionModel.countDocuments({ userSub: sub }),
	],
	[
		"notifications",
		(sub) =>
			NotificationModel.create({ userSub: sub, type: "notification.test" }),
		(sub) => NotificationModel.countDocuments({ userSub: sub }),
	],
	[
		"notification_preferences",
		(sub) => NotificationPreferencesModel.create({ userSub: sub, events: [] }),
		(sub) => NotificationPreferencesModel.countDocuments({ userSub: sub }),
	],
	[
		"client_history",
		(sub) =>
			HistoryModel.create({
				userSub: sub,
				draft: { method: "GET" },
				response: { status: 200, ms: 1, size: 1, route: "direct" },
			}),
		(sub) => HistoryModel.countDocuments({ userSub: sub }),
	],
	[
		"client_drafts",
		(sub) =>
			DraftModel.create({ userSub: sub, tabId: "t1", order: 0, draft: {} }),
		(sub) => DraftModel.countDocuments({ userSub: sub }),
	],
	[
		"client_settings",
		(sub) => ClientSettingsModel.create({ userSub: sub }),
		(sub) => ClientSettingsModel.countDocuments({ userSub: sub }),
	],
	[
		"usage_counters",
		(sub) => UsageCounterModel.create({ ownerSub: sub, yyyymm: "202610" }),
		(sub) => UsageCounterModel.countDocuments({ ownerSub: sub }),
	],
	[
		"trial_extension_requests",
		(sub) =>
			TrialExtensionModel.create({
				userSub: sub,
				reason: "More time",
				status: "pending",
				requestedAt: new Date(),
			}),
		(sub) => TrialExtensionModel.countDocuments({ userSub: sub }),
	],
	[
		"feedback (pro interest)",
		(sub) =>
			FeedbackModel.create({
				type: "pro_interest",
				email: `${sub}@example.test`,
				userSub: sub,
				name: sub,
				source: "landing",
				consentAt: new Date(),
			}),
		(sub) =>
			FeedbackModel.countDocuments({ type: "pro_interest", userSub: sub }),
	],
	[
		"feedback (contact)",
		(sub) =>
			ContactMessageModel.create({
				type: "contact",
				category: "feedback",
				message: "Hello",
				source: "landing",
				userSub: sub,
			}),
		(sub) =>
			ContactMessageModel.countDocuments({ type: "contact", userSub: sub }),
	],
	[
		"audit_events",
		(sub) =>
			AuditEventModel.create({
				_id: `jti-${sub}`,
				sub,
				type: "session.revoked",
				occurredAt: new Date(),
				data: {},
			}),
		(sub) => AuditEventModel.countDocuments({ sub }),
	],
];
