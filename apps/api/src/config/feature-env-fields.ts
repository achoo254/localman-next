import { z } from "zod";
import { parseCidr } from "../modules/api-client/ssrf-guard-ranges.js";

/**
 * Field schemas of the feature settings (`feature-env.ts`): parsing and
 * validation of one variable each, no cross-field rules.
 */

/** `host[:port]` without scheme, e.g. `localman.hoandat.com`, `localhost:4100`. */
export const hostWithPort = z
	.string()
	.trim()
	.toLowerCase()
	.regex(
		/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/,
		"must be a host name with an optional port, without scheme",
	);

/** `true`/`false` switch of an unreleased feature, off unless set. */
export const offByDefault = z
	.enum(["true", "false"], { error: "must be true or false" })
	.default("false")
	.transform((value) => value === "true");

/** Requests per second allowed by a mock rate limit. */
export const perSecond = (fallback: number) =>
	z.coerce.number().int().min(1).max(100_000).default(fallback);

/** Comma-separated IdP subjects; blanks are ignored. */
export const subjectList = z
	.string()
	.default("")
	.transform((value) =>
		value
			.split(",")
			.map((sub) => sub.trim())
			.filter((sub) => sub !== ""),
	);

/** Comma-separated IPs or CIDRs (IPv4 or IPv6); blanks are ignored. */
export const cidrList = z
	.string()
	.default("")
	.transform((value) =>
		value
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry !== ""),
	)
	.refine(
		(entries) => entries.every((entry) => parseCidr(entry) !== null),
		"must be comma-separated IP addresses or CIDRs",
	);

/** A DNS name without scheme or port: labels of letters, digits and `-`. */
const DOMAIN_NAME =
	/^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Comma-separated domain names, lowercased; blanks and repeats dropped. */
export const domainList = z
	.string()
	.default("")
	.transform((value) => [
		...new Set(
			value
				.split(",")
				.map((entry) => entry.trim().toLowerCase().replace(/\.$/, ""))
				.filter((entry) => entry !== ""),
		),
	])
	.refine(
		(entries) => entries.every((entry) => DOMAIN_NAME.test(entry)),
		"must be comma-separated domain names without scheme or port",
	);
