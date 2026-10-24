/**
 * The browser vault of local secret values, as both sides see it. The
 * browser encrypts a secret's local value with a key derived from the
 * user's passphrase (`apps/web/src/features/secure-vault/vault-crypto.ts`);
 * the server only ever stores the `lmv1:` ciphertext and the parameters
 * that let another device prove the passphrase. See ADR-0009 for the
 * per-variable copy agents may use.
 */
import { z } from "zod";
import { VARIABLE_VALUE_MAX } from "./environment-model.js";

/** Prefix of every vault ciphertext (version 1). */
export const VAULT_PREFIX = "lmv1:";

/**
 * Longest ciphertext of a value within `VARIABLE_VALUE_MAX` characters:
 * up to 4 UTF-8 bytes each, plus IV (12) and tag (16), in base64url.
 */
export const VAULT_CIPHERTEXT_MAX =
	VAULT_PREFIX.length + Math.ceil(((VARIABLE_VALUE_MAX * 4 + 28) * 4) / 3);

/** Shortest real ciphertext: IV and tag of an empty value. */
const VAULT_CIPHERTEXT_MIN = VAULT_PREFIX.length + Math.ceil((28 * 4) / 3);

const CIPHERTEXT = /^lmv1:[A-Za-z0-9_-]+$/;

/** A well-formed `lmv1:` ciphertext (it may still fail to open). */
export function isVaultCiphertext(value: string): boolean {
	return (
		value.length >= VAULT_CIPHERTEXT_MIN &&
		value.length <= VAULT_CIPHERTEXT_MAX &&
		CIPHERTEXT.test(value)
	);
}

/** Bounds the browser may use; the web uses OWASP's 600,000. */
export const VAULT_ITERATIONS_MIN = 100_000;
export const VAULT_ITERATIONS_MAX = 10_000_000;

/** What another device needs to derive the key and prove the passphrase. */
export const secretVaultParamsSchema = z.object({
	/** base64url of 16 random bytes. */
	salt: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
	iterations: z
		.number()
		.int()
		.min(VAULT_ITERATIONS_MIN)
		.max(VAULT_ITERATIONS_MAX),
	/** Ciphertext of a fixed text: opening it proves the passphrase. */
	check: z.string().refine(isVaultCiphertext, "must be an lmv1: ciphertext"),
});
export type SecretVaultParams = z.infer<typeof secretVaultParamsSchema>;

/** Hosts one secret may be sent to by agents (ADR-0009). */
export const AGENT_HOSTS_MAX = 20;

const HOST_LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const AGENT_HOST = new RegExp(
	`^(?:\\*\\.)?(?:${HOST_LABEL}\\.)*${HOST_LABEL}$`,
);

/** A host (`api.example.com`) or every subdomain of one (`*.example.com`). */
export const agentHostSchema = z
	.string()
	.trim()
	.toLowerCase()
	.max(253)
	.regex(
		AGENT_HOST,
		"must be a host name such as api.example.com or *.example.com",
	);

export const agentHostsSchema = z
	.array(agentHostSchema)
	.min(1)
	.max(AGENT_HOSTS_MAX);

/** Whether `host` (any case, no port) is one of `patterns`. */
export function agentHostAllowed(
	host: string,
	patterns: readonly string[],
): boolean {
	const name = host.toLowerCase().replace(/\.$/, "");
	return patterns.some((pattern) =>
		pattern.startsWith("*.")
			? name.endsWith(pattern.slice(1)) && name.length > pattern.length - 1
			: name === pattern,
	);
}
