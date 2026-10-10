import type {
	ShareableElementType,
	WorkspaceRole,
} from "@localman/shared/access";
import { Types } from "mongoose";
import request from "supertest";
import { beforeEach } from "vitest";
import { createLogger } from "../../../logger.js";
import {
	testApp,
	useDashboardTestDb,
} from "../../../test-support/dashboard-test-app.js";
import { NotificationModel } from "../../notifications/notification-model.js";
import { setNotificationService } from "../../notifications/notification-runtime.js";
import { NotificationService } from "../../notifications/notification-service.js";
import { UserModel } from "../../users/user-model.js";
import { WorkspaceMemberModel } from "../../workspaces/workspace-member-model.js";
import { WorkspaceModel } from "../../workspaces/workspace-model.js";
import {
	type ElementRecord,
	registerElementAdapter,
	resetElementAdapters,
} from "../element-adapters.js";

/** TEST ONLY. Accounts of the access tests. */
export const ADA = "acc_ada";
export const EVE = "acc_eve";
export const VIC = "acc_vic";
/** Not in any workspace; email `ollie@example.com`, IdP-verified. */
export const OLLIE = "acc_ollie";
/** Not in any workspace; email `una@example.com`, not verified. */
export const UNA = "acc_una";

const USERS = [
	{ sub: ADA, username: "ada", name: "Ada", email: "ada@example.com" },
	{ sub: EVE, username: "eve", name: "Eve" },
	{ sub: VIC, username: "vic" },
	{
		sub: OLLIE,
		username: "ollie",
		email: "Ollie@Example.com",
		emailVerified: true,
	},
	{ sub: UNA, username: "una", email: "una@example.com" },
];

/** In-memory collections and environments behind the test adapters. */
export const fakeElements = new Map<string, ElementRecord>();

function keyOf(type: ShareableElementType, id: string): string {
	return `${type}:${id}`;
}

let service = new NotificationService({ logger: createLogger("silent") });

/**
 * TEST ONLY. Mongo per file with the users above, a notification service
 * without optional channels, and adapters for both element types reading
 * `fakeElements` (real ones arrive with collections and environments).
 */
export function useAccessTestDb(): void {
	useDashboardTestDb();
	beforeEach(async () => {
		service = new NotificationService({ logger: createLogger("silent") });
		setNotificationService(service);
		await UserModel.create(USERS);
		fakeElements.clear();
		resetElementAdapters();
		for (const type of ["collection", "environment"] as const) {
			registerElementAdapter(type, {
				load: async (id) => fakeElements.get(keyOf(type, id)) ?? null,
				moveTo: async (id, workspaceId) => {
					const element = fakeElements.get(keyOf(type, id));
					if (!element) throw new Error(`no ${type} ${id}`);
					fakeElements.set(keyOf(type, id), { ...element, workspaceId });
				},
			});
		}
	});
}

/** A team workspace with these accepted members. */
export async function teamWorkspace(
	members: Readonly<Record<string, WorkspaceRole>>,
	name = "Team",
): Promise<Types.ObjectId> {
	const entries = Object.entries(members);
	const owner = entries.find(([, role]) => role === "admin")?.[0] ?? ADA;
	const workspace = await WorkspaceModel.create({
		name,
		type: "team",
		visibility: "team",
		ownerId: owner,
	});
	await WorkspaceMemberModel.create(
		entries.map(([userId, role]) => ({
			workspaceId: workspace._id,
			userId,
			role,
			status: "accepted" as const,
			invitedBy: owner,
		})),
	);
	return workspace._id;
}

export async function personalWorkspace(
	ownerId: string,
): Promise<Types.ObjectId> {
	const workspace = await WorkspaceModel.create({
		name: "My Workspace",
		type: "personal",
		visibility: "personal",
		ownerId,
	});
	return workspace._id;
}

/** Adds an element to the fake store and returns it. */
export function addElement<T extends ShareableElementType>(
	type: T,
	workspaceId: Types.ObjectId,
	name = type === "collection" ? "Orders API" : "Staging",
): ElementRecord & { readonly type: T } {
	const element = {
		type,
		id: new Types.ObjectId().toHexString(),
		name,
		workspaceId,
	};
	fakeElements.set(keyOf(type, element.id), element);
	return element;
}

export const elementPath = (element: ElementRecord, suffix = ""): string =>
	`/elements/${element.type}/${element.id}${suffix}`;

/** Waits for background notifications, then returns `sub`'s, oldest first. */
export async function notificationsOf(
	sub: string,
): Promise<{ type: string; params: Record<string, unknown>; link?: string }[]> {
	await service.drain();
	return NotificationModel.find({ userSub: sub })
		.sort({ _id: 1 })
		.lean<{ type: string; params: Record<string, unknown>; link?: string }[]>();
}

/** PATCH as a signed-in user (the shared test caller has no PATCH). */
export function patchAs(sub: string, path: string, body: object): request.Test {
	return request(testApp)
		.patch(`/api/v1${path}`)
		.set("x-test-sub", sub)
		.set("origin", "https://localman.test")
		.send(body);
}
