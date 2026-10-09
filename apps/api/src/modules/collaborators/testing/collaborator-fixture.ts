import type request from "supertest";
import { beforeEach, expect } from "vitest";
import { createLogger } from "../../../logger.js";
import {
	as,
	useDashboardTestDb,
} from "../../../test-support/dashboard-test-app.js";
import { setNotificationService } from "../../notifications/notification-runtime.js";
import { NotificationService } from "../../notifications/notification-service.js";
import { UserModel } from "../../users/user-model.js";

/** TEST ONLY. Accounts of the collaborator tests. */
export const OWNER = "acc_owner";
export const BOB = "acc_bob";
/** Email `carol@example.com`, not verified by the IdP. */
export const CAROL = "acc_carol";
export const DAVE = "acc_dave";
export const ERIN = "acc_erin";

export const USERS = [
	{
		sub: OWNER,
		username: "owner",
		name: "Owner",
		email: "owner@example.com",
		emailVerified: true,
	},
	{
		sub: BOB,
		username: "bob",
		name: "Bob",
		email: "Bob@Example.com",
		emailVerified: true,
	},
	{
		sub: CAROL,
		username: "carol",
		email: "carol@example.com",
		emailVerified: false,
	},
	{
		sub: DAVE,
		username: "dave",
		email: "dave@example.com",
		emailVerified: true,
	},
	{ sub: ERIN, username: "erin" },
] as const;

/**
 * TEST ONLY. Mongo per file with the users above and a notification
 * service without optional channels; `settings` as in useDashboardTestDb.
 */
export function useCollaboratorTestDb(
	settings?: Parameters<typeof useDashboardTestDb>[0],
): void {
	useDashboardTestDb(settings);
	beforeEach(async () => {
		setNotificationService(
			new NotificationService({ logger: createLogger("silent") }),
		);
		await UserModel.create(USERS.map((user) => ({ ...user })));
	});
}

export async function createProject(
	sub: string,
	name = "Demo",
): Promise<string> {
	const res = await as(sub).send("post", "/projects", { name });
	expect(res.status).toBe(201);
	return res.body.id as string;
}

export const collaboratorsPath = (projectId: string, suffix = ""): string =>
	`/projects/${projectId}/collaborators${suffix}`;

export const magicLinkPath = (projectId: string): string =>
	`/projects/${projectId}/magic-link`;

export function invite(
	ownerSub: string,
	projectId: string,
	usernameOrEmail: string,
): request.Test {
	return as(ownerSub).send("post", collaboratorsPath(projectId), {
		usernameOrEmail,
	});
}

/** The token of an `/invite/:token` link. */
export function tokenOf(link: string): string {
	const token = link.split("/").at(-1);
	if (!link.startsWith("/invite/") || !token) {
		throw new Error(`not an invite link: ${link}`);
	}
	return token;
}

/** Invites and returns the token of the link (expects 201). */
export async function inviteToken(
	ownerSub: string,
	projectId: string,
	usernameOrEmail: string,
): Promise<string> {
	const res = await invite(ownerSub, projectId, usernameOrEmail);
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return tokenOf(res.body.inviteLink as string);
}

export function accept(sub: string, token: string): request.Test {
	return as(sub).send("post", "/invites/accept", { token });
}

export function preview(sub: string, token: string): request.Test {
	return as(sub).send("post", "/invites/preview", { token });
}

/** Invites `usernameOrEmail` and accepts as `sub` (expects success). */
export async function addMember(
	ownerSub: string,
	projectId: string,
	sub: string,
	usernameOrEmail: string,
): Promise<void> {
	const token = await inviteToken(ownerSub, projectId, usernameOrEmail);
	const res = await accept(sub, token);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	expect(res.body).toEqual({ projectId, alreadyMember: false });
}

/** Creates the project's magic link and returns its token. */
export async function magicToken(
	ownerSub: string,
	projectId: string,
): Promise<string> {
	const res = await as(ownerSub).send("post", magicLinkPath(projectId));
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return tokenOf(res.body.link as string);
}
