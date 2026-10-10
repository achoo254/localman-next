import { expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";
import { AccessRequestModel } from "../access-request-model.js";
import {
	ADA,
	EVE,
	OLLIE,
	VIC,
	addElement,
	teamWorkspace,
} from "./access-fixture.js";

/** TEST ONLY. A collection of a team with Ada (admin), Eve (editor), Vic (viewer). */
export async function teamCollection() {
	const ws = await teamWorkspace({
		[ADA]: "admin",
		[EVE]: "editor",
		[VIC]: "viewer",
	});
	return addElement("collection", ws);
}

export const ask = (
	sub: string,
	path: string,
	role: "editor" | "viewer",
	message?: string,
) => as(sub).send("post", `${path}/access-requests`, { role, message });

/** Asks as Ollie and returns the id of the stored request. */
export async function askAsOllie(
	path: string,
	role: "editor" | "viewer" = "viewer",
): Promise<string> {
	const res = await ask(OLLIE, path, role, "Need it for the release");
	expect(res.status, JSON.stringify(res.body)).toBe(200);
	const row = await AccessRequestModel.findOne({ requesterId: OLLIE }).lean();
	if (!row) throw new Error("no request stored");
	return row._id.toHexString();
}
