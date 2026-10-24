import { randomInt } from "node:crypto";
import { type AnyOperation, defineOperation } from "@localman/operations";
import { generateVnFakeData } from "@localman/shared/vn-fake-data";
import {
	FAKE_DATA_LIMIT_PER_MINUTE,
	createIpMinuteLimiter,
} from "./fake-data-rate-limit.js";
import {
	FAKE_DATA_NOTICE,
	fakeDataInput,
	fakeDataView,
} from "./fake-data-schemas.js";

const takeSlot = createIpMinuteLimiter(FAKE_DATA_LIMIT_PER_MINUTE);

/**
 * Public, stateless generator of Vietnamese-style test data (the web tool
 * at `/tools/vn-fake-data` builds the same records in the browser).
 * Nothing is read from or written to the database; it runs in the
 * tenant of its host like every route. Behind `PUBLIC_FAKE_DATA_ENABLED`.
 */
export const generateFakeData = defineOperation({
	id: "public.generateFakeData",
	method: "GET",
	path: "/public/fake-data",
	summary: "Generate Vietnamese fake test data",
	description: `Public, no sign-in. Vietnamese-style fake records for tests and mock APIs: \`person\` (full name, gender, date of birth and a CCCD that matches them), \`address\` (street, ward and province on the 34-province map), \`phone\` (10-digit mobile number on a prefix in use), \`cccd\` (12-digit citizen ID number: real province code, century/gender digit, two-digit birth year, six random digits) or \`company\` (name, random 10-digit tax code, address, phone). \`locale\` \`vi\` keeps Vietnamese diacritics; \`en\` drops them and uses English labels. Every value is invented and nothing is stored; the answer says so in \`fake\` and \`notice\`. 429 RATE_LIMITED past ${FAKE_DATA_LIMIT_PER_MINUTE} calls a minute per client address.`,
	input: fakeDataInput,
	output: fakeDataView,
	scopes: [],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "public",
	mcp: true,
	handler: (ctx, input) => {
		// Counted before any work, so a flood costs the caller, not the server.
		takeSlot(ctx.clientIp);
		return {
			fake: true as const,
			notice: FAKE_DATA_NOTICE,
			type: input.type,
			locale: input.locale,
			items: generateVnFakeData({ ...input, seed: randomInt(2 ** 32) }),
		};
	},
});

/** Every operation behind `PUBLIC_FAKE_DATA_ENABLED`. */
export const publicFakeDataOperations: readonly AnyOperation[] = [
	generateFakeData,
];
