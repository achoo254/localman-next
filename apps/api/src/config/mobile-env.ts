import { z } from "zod";

/** SHA-256 of a signing certificate as Android prints it: `AA:BB:…` (32 bytes). */
const CERT_SHA256 = /^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/;

/**
 * Native apps that may receive a mobile sign-in (Universal Links / App
 * Links). The bundle id and package name come from brand.config.json;
 * these say which signed builds are ours. Neither set: the association
 * files answer 404 and `/auth/login?client=mobile` is refused, so the
 * mobile sign-in is off (docs/decisions/0005-mobile-session-handoff.md).
 */
export const mobileEnvShape = {
	/** Apple Developer Team ID (10 characters), prefix of the iOS app id. */
	MOBILE_IOS_TEAM_ID: z
		.string()
		.trim()
		.regex(/^[A-Z0-9]{10}$/, "must be a 10-character Apple Team ID")
		.optional(),
	/**
	 * SHA-256 fingerprints of the Android signing certificates (upload key
	 * and Play App Signing key), comma separated; blanks are ignored.
	 */
	MOBILE_ANDROID_CERT_SHA256: z
		.string()
		.default("")
		.transform((value) =>
			value
				.split(",")
				.map((entry) => entry.trim().toUpperCase())
				.filter((entry) => entry !== ""),
		)
		.refine(
			(entries) => entries.every((entry) => CERT_SHA256.test(entry)),
			"must be comma-separated SHA-256 fingerprints (AA:BB:… 32 bytes)",
		),
};
