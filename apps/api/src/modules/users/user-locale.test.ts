import { describe, expect, it } from "vitest";
import { NotificationModel } from "../notifications/notification-model.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import {
	ALICE,
	as,
	useOperationsFixture,
} from "../notifications/testing/operations-fixture.js";

useOperationsFixture();

const setLocale = (locale: unknown, sub = ALICE) =>
	as(sub).send("put", "/users/me/locale", { locale });

const titlesAndBodies = async () =>
	(await as(ALICE).get("/notifications")).body.items.map(
		(item: { title: string; body: string }) => [item.title, item.body],
	);

describe("PUT /users/me/locale", () => {
	it("defaults to en, then saves a supported locale that /users/me returns", async () => {
		expect((await as(ALICE).get("/users/me")).body.locale).toBe("en");
		const res = await setLocale("zh-CN");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ locale: "zh-CN" });
		expect((await as(ALICE).get("/users/me")).body.locale).toBe("zh-CN");
	});

	it.each([["fr"], ["EN"], ["zh"], [""], [null], [1]])(
		"refuses %j with 400 and keeps the saved locale",
		async (locale) => {
			await setLocale("vi");
			const res = await setLocale(locale);
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
			expect((await as(ALICE).get("/users/me")).body.locale).toBe("vi");
		},
	);

	it("answers 401 for a subject without a user", async () => {
		expect((await setLocale("vi", "acc_ghost")).status).toBe(401);
	});
});

describe("in-app notifications follow the current locale", () => {
	it("renders received notifications again after a language change", async () => {
		await getNotificationService().notify(ALICE, {
			type: "project.mockUrlChanged",
			params: { project: "Shop" },
			link: "/projects/abc",
		});
		expect(await titlesAndBodies()).toEqual([
			[
				"Mock URL changed",
				'The project owner changed the mock URL of the project "Shop". The old URL no longer works; use the new URL on the project page.',
			],
		]);
		await setLocale("vi");
		expect(await titlesAndBodies()).toEqual([
			[
				"URL mock đã đổi",
				'Chủ project đã đổi URL mock của project "Shop". URL cũ không còn hoạt động; hãy dùng URL mới trong trang project.',
			],
		]);
		await setLocale("zh-CN");
		const [[title, body]] = await titlesAndBodies();
		expect(title).toBe("Mock URL 已更改");
		expect(body).toContain("project“Shop”的 mock URL");
	});

	it("still shows records stored as text before translation", async () => {
		const legacy = await NotificationModel.create({
			userSub: ALICE,
			type: "project.invitation",
			title: "Lời mời cộng tác project",
			body: 'Bình mời bạn cộng tác trong project "Cũ".',
		});
		await setLocale("zh-CN");
		expect(await titlesAndBodies()).toEqual([
			["Lời mời cộng tác project", 'Bình mời bạn cộng tác trong project "Cũ".'],
		]);
		const read = await as(ALICE).send(
			"post",
			`/notifications/${legacy._id.toHexString()}/read`,
		);
		expect(read.body.title).toBe("Lời mời cộng tác project");
	});

	it("labels event types on the preferences page in the user's language", async () => {
		const labels = async () =>
			(await as(ALICE).get("/notification-preferences")).body.events.map(
				(event: { label: string }) => event.label,
			);
		expect((await labels())[0]).toBe("Project collaboration invitations");
		await setLocale("vi");
		expect((await labels())[0]).toBe("Lời mời cộng tác project");
		await setLocale("zh-CN");
		expect((await labels())[0]).toBe("Project 协作邀请");
	});
});
