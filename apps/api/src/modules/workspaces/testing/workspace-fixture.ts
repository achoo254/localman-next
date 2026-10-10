import request from "supertest";
import { expect } from "vitest";
import { as, testApp } from "../../../test-support/dashboard-test-app.js";

/** TEST ONLY. Helpers of the workspace tests (users: collaborator-fixture). */

const ORIGIN = "https://localman.test";

/** PATCH as a signed-in user (the shared test caller has no PATCH). */
export function patchAs(sub: string, path: string, body: object): request.Test {
	return request(testApp)
		.patch(`/api/v1${path}`)
		.set("origin", ORIGIN)
		.set("x-forwarded-for", "198.51.100.1")
		.set("x-test-sub", sub)
		.send(body);
}

export const workspacePath = (workspaceId: string, suffix = ""): string =>
	`/workspaces/${workspaceId}${suffix}`;

export async function createWorkspace(
	sub: string,
	name = "Team",
): Promise<string> {
	const res = await as(sub).send("post", "/workspaces", { name });
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return res.body.id as string;
}

export function inviteTo(
	adminSub: string,
	workspaceId: string,
	usernameOrEmail: string,
	role = "editor",
): request.Test {
	return as(adminSub).send("post", workspacePath(workspaceId, "/invitations"), {
		usernameOrEmail,
		role,
	});
}

export function createLink(
	adminSub: string,
	workspaceId: string,
	role = "viewer",
): request.Test {
	return as(adminSub).send(
		"post",
		workspacePath(workspaceId, "/invite-links"),
		{ role },
	);
}

/** The token of a `/workspace-invite/:token` link. */
export function workspaceTokenOf(link: string): string {
	const token = link.split("/").at(-1);
	if (!link.startsWith("/workspace-invite/") || !token) {
		throw new Error(`not a workspace invite link: ${link}`);
	}
	return token;
}

/** Invites and returns the token of the link (expects 201). */
export async function inviteTokenTo(
	adminSub: string,
	workspaceId: string,
	usernameOrEmail: string,
	role = "editor",
): Promise<string> {
	const res = await inviteTo(adminSub, workspaceId, usernameOrEmail, role);
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return workspaceTokenOf(res.body.inviteLink as string);
}

export function acceptWorkspace(sub: string, token: string): request.Test {
	return as(sub).send("post", "/workspace-invites/accept", { token });
}

export function previewWorkspace(sub: string, token: string): request.Test {
	return as(sub).send("post", "/workspace-invites/preview", { token });
}

/** Invites `usernameOrEmail` with `role` and accepts as `sub`. */
export async function addWorkspaceMember(
	adminSub: string,
	workspaceId: string,
	sub: string,
	usernameOrEmail: string,
	role = "editor",
): Promise<void> {
	const token = await inviteTokenTo(
		adminSub,
		workspaceId,
		usernameOrEmail,
		role,
	);
	const res = await acceptWorkspace(sub, token);
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	expect(res.body).toEqual({ workspaceId, alreadyMember: false });
}

/** The member row id of `sub` in the workspace, as an Admin lists it. */
export async function memberIdOf(
	adminSub: string,
	workspaceId: string,
	sub: string,
): Promise<string> {
	const res = await as(adminSub).get(workspacePath(workspaceId, "/members"));
	const member = (res.body.members as { id: string; userId: string }[]).find(
		(row) => row.userId === sub,
	);
	if (!member) throw new Error(`${sub} is not a member`);
	return member.id;
}
