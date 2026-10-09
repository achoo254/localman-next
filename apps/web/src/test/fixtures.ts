import type { CurrentUser } from "../features/auth/current-user";
import type { AppNotification } from "../features/notifications/notifications-api";

export function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
	return {
		sub: "user-1",
		username: "minhanh",
		email: "minhanh@example.com",
		emailVerified: true,
		name: "Minh Anh",
		picture: null,
		plan: "free",
		telegram: { linked: false, username: null },
		...overrides,
	};
}

export function makeNotification(
	id: string,
	overrides: Partial<AppNotification> = {},
): AppNotification {
	return {
		id,
		type: "project.invited",
		title: `Thông báo ${id}`,
		body: "Nội dung",
		link: null,
		readAt: null,
		createdAt: "2026-10-09T01:00:00.000Z",
		...overrides,
	};
}
