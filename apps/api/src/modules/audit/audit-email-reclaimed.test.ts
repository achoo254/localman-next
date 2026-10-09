import { type JWK, exportJWK, generateKeyPair } from "jose";
import { Types } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import {
	AUDIT_CREDENTIALS,
	type AuthHarness,
	PUBLIC_URL,
	startAuthHarness,
} from "../auth/testing/auth-harness.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import { UserModel } from "../users/user-model.js";
import { basic, signSecurityEvent } from "./testing/security-events.js";

const LOSER = "acc_lost_email";
let harness: AuthHarness;
let teardownMongo: () => Promise<void>;
let foreignKey: JWK;

beforeAll(async () => {
	teardownMongo = await connectTestMongo();
	harness = await startAuthHarness();
	const { privateKey } = await generateKeyPair("ES256", { extractable: true });
	foreignKey = { ...(await exportJWK(privateKey)), kid: "fake-idp-key" };
});
afterAll(async () => {
	await harness?.close();
	await teardownMongo?.();
});
beforeEach(async () => {
	await clearCollections();
	await UserModel.create({
		sub: LOSER,
		username: "loser",
		email: "shared@example.com",
		emailVerified: false,
	});
});

async function postReclaimed(): Promise<request.Response> {
	const token = await signSecurityEvent(
		{
			issuer: harness.issuer,
			audience: `${PUBLIC_URL}/internal/audit-events`,
			sub: LOSER,
			key: harness.idp.signingKey,
			foreignKey,
		},
		{ type: "email.reclaimed", data: {} },
	);
	return request(harness.app)
		.post("/internal/audit-events")
		.set(
			"authorization",
			basic(AUDIT_CREDENTIALS.clientId, AUDIT_CREDENTIALS.clientSecret),
		)
		.set("content-type", "application/secevent+jwt")
		.send(token);
}

interface InvitationFields {
	readonly inviteeUserId?: string;
	readonly inviteeEmail?: string;
	readonly inviteTokenHash?: string;
	readonly status?: "pending" | "accepted";
}

function invitation(fields: InvitationFields) {
	return {
		projectId: new Types.ObjectId(),
		status: "pending" as const,
		invitedBy: "acc_owner",
		expiresAt: new Date(Date.now() + 60_000),
		...fields,
	};
}

describe("email.reclaimed audit event", () => {
	it("drops the email and unbinds invitations bound through it", async () => {
		const [byEmail, byUsername, accepted] = await CollaboratorModel.create([
			invitation({
				inviteeUserId: LOSER,
				inviteeEmail: "shared@example.com",
				inviteTokenHash: "a".repeat(64),
			}),
			invitation({ inviteeUserId: LOSER, inviteTokenHash: "b".repeat(64) }),
			invitation({
				inviteeUserId: LOSER,
				inviteeEmail: "shared@example.com",
				status: "accepted",
			}),
		]);
		expect((await postReclaimed()).status).toBe(202);

		const user = await UserModel.findOne({ sub: LOSER }).lean();
		expect(user?.email).toBeUndefined();
		expect(user?.emailVerified).toBe(false);
		const rows = await CollaboratorModel.find().lean();
		const byId = (id: unknown) =>
			rows.find((row) => row._id.equals(String(id)));
		// Still addressed to the email, which its verified owner can accept.
		expect(byId(byEmail?._id)).toMatchObject({
			inviteeEmail: "shared@example.com",
		});
		expect(byId(byEmail?._id)).not.toHaveProperty("inviteeUserId");
		expect(byId(byUsername?._id)?.inviteeUserId).toBe(LOSER);
		expect(byId(accepted?._id)?.inviteeUserId).toBe(LOSER);
	});
});
