import type { CurrentUser } from "../features/auth/current-user";
import type { AppNotification } from "../features/notifications/notifications-api";
import type { Project } from "../pages/projects/projects-api";

export function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
	return {
		sub: "user-1",
		username: "minhanh",
		email: "minhanh@example.com",
		emailVerified: true,
		name: "Minh Anh",
		picture: null,
		plan: "free",
		isOwner: false,
		telegram: { linked: false, username: null },
		locale: "en",
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
		accessRequest: null,
		...overrides,
	};
}

export function makeProject(
	id: string,
	overrides: Partial<Project> = {},
): Project {
	return {
		id,
		name: `Project ${id}`,
		prefix: "",
		secret: `secret${id}`,
		mockBaseUrl: `https://secret${id}.mock.localman.test`,
		role: "owner",
		owner: {
			sub: "user-1",
			username: "minhanh",
			name: "Minh Anh",
			picture: null,
		},
		memberCount: 1,
		createdAt: "2026-10-09T01:00:00.000Z",
		...overrides,
	};
}
