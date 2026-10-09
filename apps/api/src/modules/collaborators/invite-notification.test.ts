import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createLogger } from "../../logger.js";
import { SessionModel } from "../auth/session-model.js";
import { TelegramBotClient } from "../notifications/channels/telegram-bot-client.js";
import { TelegramChannel } from "../notifications/channels/telegram-channel.js";
import {
	type PushSender,
	WebPushChannel,
} from "../notifications/channels/web-push-channel.js";
import { NotificationModel } from "../notifications/notification-model.js";
import { updateEventPreferences } from "../notifications/notification-preferences-model.js";
import { setNotificationService } from "../notifications/notification-runtime.js";
import { NotificationService } from "../notifications/notification-service.js";
import { PushSubscriptionModel } from "../notifications/push-subscription-model.js";
import {
	type FakeBotApi,
	startFakeBotApi,
} from "../notifications/testing/fake-bot-api.js";
import { UserModel } from "../users/user-model.js";
import {
	BOB,
	CAROL,
	OWNER,
	createProject,
	invite,
	useCollaboratorTestDb,
} from "./testing/collaborator-fixture.js";

useCollaboratorTestDb();

const logger = createLogger("silent");
let bot: FakeBotApi | undefined;
let service: NotificationService;
const pushSender = vi.fn<PushSender>();

beforeAll(async () => {
	bot = await startFakeBotApi();
});
afterAll(async () => {
	await bot?.close();
});
beforeEach(async () => {
	bot?.reset();
	pushSender.mockReset().mockResolvedValue({ statusCode: 201 });
	const url = bot?.url ?? "";
	service = new NotificationService({
		logger,
		webPush: new WebPushChannel(
			{ publicKey: "BPub", privateKey: "priv", subject: "mailto:a@b.c" },
			logger,
			(...args) => pushSender(...args),
		),
		telegram: new TelegramChannel(
			new TelegramBotClient({ token: "1:t", logger, apiBaseUrl: url }),
			"https://localman.test",
		),
	});
	setNotificationService(service);
	await UserModel.updateOne(
		{ sub: BOB },
		{ $set: { "telegram.chatId": "42" } },
	);
	await SessionModel.create({
		_id: "session-bob",
		sub: BOB,
		tokens: "unused",
		accessTokenExpiresAt: new Date(),
		expiresAt: new Date(Date.now() + 60_000),
	});
	await PushSubscriptionModel.create({
		userSub: BOB,
		sessionId: "session-bob",
		endpoint: "https://fcm.googleapis.com/fcm/send/bob",
		keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) },
	});
});

describe("invitation notifications", () => {
	it("reaches the invitee on every channel they chose, with the invite link", async () => {
		await updateEventPreferences(BOB, [
			{ type: "project.invitation", webPush: true, telegram: true },
		]);
		const projectId = await createProject(OWNER);
		const res = await invite(OWNER, projectId, "bob");
		expect(res.status).toBe(201);
		await service.drain();
		const stored = await NotificationModel.find({ userSub: BOB }).lean();
		expect(stored).toHaveLength(1);
		expect(stored[0]).toMatchObject({
			type: "project.invitation",
			link: res.body.inviteLink,
		});
		expect(stored[0]?.params).toEqual({
			inviter: "Owner",
			project: "Demo",
			days: 7,
		});
		expect(pushSender).toHaveBeenCalledTimes(1);
		expect(bot?.requests).toHaveLength(1);
		expect(String(bot?.requests[0]?.text)).toContain(
			`https://localman.test${res.body.inviteLink}`,
		);
		expect(await NotificationModel.countDocuments({ userSub: OWNER })).toBe(0);
	});

	it("keeps to in-app only by default, and notifies nobody for an email invitation", async () => {
		const projectId = await createProject(OWNER);
		await invite(OWNER, projectId, "bob");
		await invite(OWNER, projectId, "someone@example.com");
		await service.drain();
		expect(await NotificationModel.countDocuments({ userSub: BOB })).toBe(1);
		expect(await NotificationModel.countDocuments()).toBe(1);
		expect(pushSender).not.toHaveBeenCalled();
		expect(bot?.requests).toHaveLength(0);
	});

	it("still returns the invitation when a channel fails", async () => {
		pushSender.mockRejectedValue(new Error("push service down"));
		await updateEventPreferences(CAROL, [
			{ type: "project.invitation", webPush: true },
		]);
		await PushSubscriptionModel.updateOne({}, { $set: { userSub: CAROL } });
		await SessionModel.updateOne({}, { $set: { sub: CAROL } });
		const projectId = await createProject(OWNER);
		const res = await invite(OWNER, projectId, "carol");
		expect(res.status).toBe(201);
		await service.drain();
		expect(pushSender).toHaveBeenCalledTimes(1);
	});
});
