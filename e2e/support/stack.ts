import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { IDP_ORIGIN, MOCK_BASE_DOMAIN, PORTS, WEB_ORIGIN } from "./ports.js";
import {
	type Service,
	assertPortFree,
	killGroupsNow,
	runCommand,
	startService,
	stopService,
	waitForHttp,
} from "./processes.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const WEB_DIR = resolve(REPO, "apps/web");
const WEB_OUT = resolve(REPO, "e2e/.web-dist");
const TSX = resolve(REPO, "node_modules/.bin/tsx");
const API_ENTRY = resolve(REPO, "apps/api/src/main.ts");
const IDP_ENTRY = resolve(REPO, "e2e/support/idp-server.ts");
const PREVIEW_CONFIG = resolve(REPO, "e2e/support/vite-preview.config.ts");
const API_ORIGIN = `http://127.0.0.1:${PORTS.api}`;
// Vite runs through Node, not `pnpm exec`: with the trimmed env below pnpm
// would not find the store it installed into and try to reinstall (CI).
const VITE = resolve(
	dirname(
		createRequire(resolve(WEB_DIR, "package.json")).resolve(
			"vite/package.json",
		),
	),
	"bin/vite.js",
);

interface RunningStack {
	readonly mongo: MongoMemoryReplSet;
	readonly services: Service[];
}

/** One stack per run: globalSetup starts it, globalTeardown stops it. */
let running: RunningStack | undefined;

/** Only the variables the stack needs: no developer `.env` leaks in. */
function baseEnv(): NodeJS.ProcessEnv {
	return { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" };
}

function apiEnv(mongoUri: string, oidcSecret: string): NodeJS.ProcessEnv {
	return {
		...baseEnv(),
		NODE_ENV: "development",
		DASHBOARD_PORT: String(PORTS.api),
		MOCK_PORT: String(PORTS.mock),
		MONGO_URI: mongoUri,
		WEB_ORIGIN,
		PUBLIC_URL: WEB_ORIGIN,
		LOG_LEVEL: "warn",
		OIDC_ISSUER: IDP_ORIGIN,
		OIDC_CLIENT_ID: "localman-web",
		OIDC_CLIENT_SECRET: oidcSecret,
		SESSION_ENCRYPTION_KEY: `k1:${randomBytes(32).toString("base64")}`,
		TRUST_PROXY: "loopback",
		MOCK_BASE_DOMAIN,
	};
}

function idpEnv(oidcSecret: string): NodeJS.ProcessEnv {
	return {
		...baseEnv(),
		E2E_IDP_ISSUER: IDP_ORIGIN,
		E2E_OIDC_CLIENT_SECRET: oidcSecret,
		E2E_PUBLIC_URL: WEB_ORIGIN,
		E2E_API_ORIGIN: API_ORIGIN,
	};
}

/**
 * Production build of the web app for the E2E: same origin for the API
 * (empty VITE_API_BASE_URL) and the local IdP for the account page.
 */
function webBuildEnv(): NodeJS.ProcessEnv {
	return {
		...baseEnv(),
		VITE_API_BASE_URL: "",
		VITE_IDP_ORIGIN: IDP_ORIGIN,
		VITE_FEATURES: "",
	};
}

/** Starts MongoDB, the API, the IdP and the web preview; resolves when all answer. */
export async function startStack(): Promise<void> {
	if (running) throw new Error("The E2E stack is already running.");
	for (const port of Object.values(PORTS)) await assertPortFree(port);

	const mongo = await MongoMemoryReplSet.create({
		replSet: { count: 1, storageEngine: "wiredTiger" },
		instanceOpts: [{ port: PORTS.mongo }],
	});
	const oidcSecret = randomBytes(24).toString("base64url");
	const services: Service[] = [];
	running = { mongo, services };
	process.once("exit", () => killGroupsNow(services));

	try {
		await runCommand(
			"web build",
			process.execPath,
			[VITE, "build", "--outDir", relative(WEB_DIR, WEB_OUT), "--emptyOutDir"],
			{ cwd: WEB_DIR, env: webBuildEnv() },
		);
		const mongoUri = mongo.getUri("localman_e2e");
		const api = startService("api", TSX, [API_ENTRY], {
			cwd: REPO,
			env: apiEnv(mongoUri, oidcSecret),
		});
		const idp = startService("fake-idp", TSX, [IDP_ENTRY], {
			cwd: REPO,
			env: idpEnv(oidcSecret),
		});
		services.push(api, idp);
		await waitForHttp(`${API_ORIGIN}/api/v1/openapi.json`, api);
		await waitForHttp(`http://127.0.0.1:${PORTS.mock}/healthz`, api);
		await waitForHttp(`${IDP_ORIGIN}/.well-known/openid-configuration`, idp);

		const web = startService(
			"web-preview",
			process.execPath,
			[VITE, "preview", "--config", PREVIEW_CONFIG],
			{ cwd: REPO, env: baseEnv() },
		);
		services.push(web);
		await waitForHttp(`${WEB_ORIGIN}/`, web);
	} catch (error) {
		await stopStack();
		throw error;
	}
}

/** Stops every service, then MongoDB. Safe to call when nothing runs. */
export async function stopStack(): Promise<void> {
	const stack = running;
	running = undefined;
	if (!stack) return;
	await Promise.all(stack.services.map(stopService));
	await stack.mongo.stop();
}
