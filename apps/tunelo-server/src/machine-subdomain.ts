/**
 * Subdomains of machine tunnels (`AuthMessage.kind === "machine"`): derived
 * from the account and the machine, so the same machine gets the same
 * subdomain on every connection and across server restarts, without any
 * stored reservation. Only that account can open it (the account comes from
 * its verified token), and no other tunnel may take a name of this shape.
 */
import { createHash } from "node:crypto";

const PREFIX = "m-";
const HASH_CHARS = 30;
const MACHINE_SUBDOMAIN = new RegExp(`^${PREFIX}[0-9a-f]{${HASH_CHARS}}$`);
/** Agents send a UUID; allow any short opaque id. */
const DEVICE_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/** The subdomain held for `deviceId` of the account `ownerSub`. */
export function machineSubdomain(ownerSub: string, deviceId: string): string {
	const digest = createHash("sha256")
		.update(`${ownerSub}\n${deviceId}`)
		.digest("hex");
	return `${PREFIX}${digest.slice(0, HASH_CHARS)}`;
}

/** Whether `subdomain` has the shape reserved for machine tunnels. */
export function isMachineSubdomain(subdomain: string): boolean {
	return MACHINE_SUBDOMAIN.test(subdomain);
}

export function isMachineDeviceId(value: unknown): value is string {
	return typeof value === "string" && DEVICE_ID.test(value);
}
