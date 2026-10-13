/**
 * Demo `users` records for the landing (hero card and schema preview).
 * Generated once with the real Faker runners of `@localman/shared`
 * (`runFakerMethod`, seed 2026) and pasted here, so the landing never
 * bundles Faker. Fields follow `DEMO_USER_SCHEMA`.
 */

/** Mock base URL of the landing samples (hero card, Mock MCP block). */
export function demoMockBaseUrl(mockBaseDomain: string): string {
	return `https://a1b2c3d4.${mockBaseDomain}/api/v1`;
}

export interface DemoUser {
	readonly id: string;
	readonly createdAt: string;
	readonly name: string;
	readonly avatar: string;
	readonly email: string;
	readonly isActive: boolean;
}

export interface DemoSchemaField {
	readonly name: keyof DemoUser;
	readonly type: "Object ID" | "Faker.js" | "Boolean";
	readonly fakerMethod?: string;
}

export const DEMO_USER_SCHEMA: readonly DemoSchemaField[] = Object.freeze([
	{ name: "id", type: "Object ID" },
	{ name: "createdAt", type: "Faker.js", fakerMethod: "date.past" },
	{ name: "name", type: "Faker.js", fakerMethod: "name.fullName" },
	{ name: "avatar", type: "Faker.js", fakerMethod: "image.avatar" },
	{ name: "email", type: "Faker.js", fakerMethod: "internet.email" },
	{ name: "isActive", type: "Boolean" },
]);

export const DEMO_USERS: readonly DemoUser[] = Object.freeze([
	{
		id: "1",
		createdAt: "2025-12-28T09:09:07.934Z",
		name: "Ashton Yundt",
		avatar: "https://avatars.githubusercontent.com/u/55825012",
		email: "Eloise36@yahoo.com",
		isActive: false,
	},
	{
		id: "2",
		createdAt: "2025-10-20T11:40:47.159Z",
		name: "Maci Wisoky",
		avatar:
			"https://cdn.jsdelivr.net/gh/faker-js/assets-person-portrait/female/512/68.jpg",
		email: "Irving.Marvin@yahoo.com",
		isActive: false,
	},
	{
		id: "3",
		createdAt: "2026-01-31T02:38:49.354Z",
		name: "Colleen Osinski",
		avatar: "https://avatars.githubusercontent.com/u/8434878",
		email: "Hudson.Zieme@gmail.com",
		isActive: false,
	},
	{
		id: "4",
		createdAt: "2026-05-15T10:24:26.874Z",
		name: "Zakary Feil Sr.",
		avatar:
			"https://cdn.jsdelivr.net/gh/faker-js/assets-person-portrait/male/512/36.jpg",
		email: "Maude27@hotmail.com",
		isActive: false,
	},
	{
		id: "5",
		createdAt: "2026-09-08T11:42:15.768Z",
		name: "Daphnee Stehr",
		avatar: "https://avatars.githubusercontent.com/u/96404597",
		email: "Viviane.Toy93@yahoo.com",
		isActive: false,
	},
	{
		id: "6",
		createdAt: "2026-03-16T09:58:05.852Z",
		name: "Lynne Metz",
		avatar: "https://avatars.githubusercontent.com/u/68962851",
		email: "Ara_Weber@hotmail.com",
		isActive: true,
	},
]);

/** Pretty JSON of two consecutive demo users starting at `page * 2`. */
export function demoUsersJson(page = 0): string {
	const start = (page * 2) % DEMO_USERS.length;
	return JSON.stringify(DEMO_USERS.slice(start, start + 2), null, 2);
}
