import { randomInt } from "node:crypto";
import { type AnyOperation, defineOperation } from "@localman/operations";
import { generateVnFakeData } from "@localman/shared/vn-fake-data";
import {
	FAKE_DATA_LIMIT_PER_MINUTE,
	createIpMinuteLimiter,
} from "./fake-data-rate-limit.js";
import {
	FAKE_DATA_MAX_SEED,
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
	description: `Vietnamese-style fake records for tests and mock APIs. Over REST it is public (no sign-in); as an MCP tool it needs a Localman MCP token with \`client:read\`, like the other tools of its toolset. Types: \`person\` (full name, gender, date of birth and a CCCD that matches them), \`address\` (street, ward and province on the 34-province map), \`phone\` (10-digit mobile number on a prefix in use), \`cccd\` (12-digit citizen ID number: real province code, century/gender digit, two-digit birth year, six random digits) or \`company\` (name, random 10-digit tax code, address, phone). \`locale\` \`vi\` keeps Vietnamese diacritics; \`en\` drops them and uses English labels. \`seed\` (0 to ${FAKE_DATA_MAX_SEED}) gives the same records again (birth dates count back from today); without it every call is new. Every value is invented and nothing is stored; the answer says so in \`fake\` and \`notice\`. 429 RATE_LIMITED past ${FAKE_DATA_LIMIT_PER_MINUTE} calls a minute per client address, with the seconds to wait in \`details.retryAfterSeconds\` (and \`Retry-After\` over REST).`,
	input: fakeDataInput,
	output: fakeDataView,
	scopes: [],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "public",
	mcp: true,
	handler: (ctx, input) => {
		// Counted before any work, so a flood costs the caller, not the server.
		takeSlot(ctx.clientIp);
		const { seed = randomInt(FAKE_DATA_MAX_SEED + 1), ...choice } = input;
		return {
			fake: true as const,
			notice: FAKE_DATA_NOTICE,
			type: choice.type,
			locale: choice.locale,
			items: generateVnFakeData({ ...choice, seed }),
		};
	},
});

/** Every operation behind `PUBLIC_FAKE_DATA_ENABLED`. */
export const publicFakeDataOperations: readonly AnyOperation[] = [
	generateFakeData,
];
