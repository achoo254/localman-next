/**
 * Child process of the E2E stack: the fake IdP on its fixed port. The
 * account of each sign-in comes from the `e2e_idp_user` cookie that the
 * test sets on the IdP origin, so every test signs in as its own user.
 */
import { type IncomingMessage, createServer } from "node:http";
import { startFakeIdp } from "../../apps/api/src/modules/auth/testing/fake-idp.js";
import type { FakeAccount } from "../../apps/api/src/modules/auth/testing/fake-idp.js";
import { IDP_USER_COOKIE, PORTS } from "./ports.js";

const env = {
	issuer: requiredEnv("E2E_IDP_ISSUER"),
	clientSecret: requiredEnv("E2E_OIDC_CLIENT_SECRET"),
	publicUrl: requiredEnv("E2E_PUBLIC_URL"),
	apiOrigin: requiredEnv("E2E_API_ORIGIN"),
};

function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
}

/** The `name=value` pair of `name` in a Cookie header, or `undefined`. */
function cookieValue(
	header: string | undefined,
	name: string,
): string | undefined {
	const pair = header
		?.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${name}=`));
	return pair?.slice(name.length + 1);
}

const DEFAULT_USERNAME = "e2e_default";

/** Deterministic account of a username: the same name always gets the same sub. */
function accountFor(username: string): FakeAccount {
	return {
		sub: `acc_${username}`,
		username,
		email: `${username}@example.test`,
		name: username,
	};
}

function accountOf(req: IncomingMessage): FakeAccount {
	return accountFor(
		cookieValue(req.headers.cookie, IDP_USER_COOKIE) ?? DEFAULT_USERNAME,
	);
}

const server = createServer();
await new Promise<void>((resolve, reject) => {
	server.once("error", reject);
	server.listen(PORTS.idp, "127.0.0.1", () => resolve());
});

await startFakeIdp({
	server,
	issuer: env.issuer,
	clientSecret: env.clientSecret,
	localmanPublicUrl: env.publicUrl,
	backchannelLogoutUri: `${env.apiOrigin}/auth/backchannel-logout`,
	account: accountFor(DEFAULT_USERNAME),
	accountOf,
});
