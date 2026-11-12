import { TunnelLinkModel, linkTokenSlot } from "../tunelo-link-model.js";
import type { TuneloTestEnv } from "./tunelo-test-setup.js";

/**
 * TEST ONLY. An anonymous machine `sub` linked with a code before that flow
 * was retired: the row as it was stored (no `source`, sealed token) and a
 * link token the fake Tunelo honours for `deviceId`. Answers the row id.
 */
export async function seedCodeLinkedMachine(
	env: TuneloTestEnv,
	sub: string,
	deviceId: string,
): Promise<string> {
	const token = env.tunelo.mintCodeLink(deviceId);
	const row = await TunnelLinkModel.create({
		userSub: sub,
		status: "linked",
		linkedAt: new Date(),
	});
	const id = String(row._id);
	await TunnelLinkModel.updateOne(
		{ _id: id },
		{
			tokenSealed: env.cipher.encrypt(token, linkTokenSlot(sub, id)),
			linkId: `link-${id}`,
		},
	);
	return id;
}
