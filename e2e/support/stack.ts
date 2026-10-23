import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
	ECHO_ORIGIN,
	IDP_ORIGIN,
	MOCK_BASE_DOMAIN,
	PORTS,
	TUNELO_ORIGIN,
	WEB_ORIGIN,
} from "./ports.js";
import {
	type Service,
	assertPortFree,
	killGroupsNow,
	startService,
	stopService,
	waitForHttp,
	waitForSuccess,
} from "./processes.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const WEB_DIR = resolve(REPO, "apps/web");
const WEB_OUT = resolve(REPO, "e2e/.web-dist");
const TSX = resolve(REPO, "node_modules/.bin/tsx");
const API_ENTRY = resolve(REPO, "apps/api/src/main.ts");
const IDP_ENTRY = resolve(REPO, "e2e/support/idp-server.ts");
const ECHO_ENTRY = resolve(REPO, "e2e/support/echo-server.ts");
const TUNELO_ENTRY = resolve(REPO, "e2e/support/tunelo-server.ts");
/** Tunnel domain of the E2E stack: the tunnel URLs in the Tunelo specs sit under it. */
const TUNNEL_DOMAIN = "tunnel.hoandat.com";
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
		VARIABLE_ENCRYPTION_KEY: `k1:${randomBytes(32).toString("base64")}`,
		TRUST_PROXY: "loopback",
		MOCK_BASE_DOMAIN,
		// Tunnel mappings accept only these domains; the Tunelo specs use one.
		TUNNEL_DOMAINS: TUNNEL_DOMAIN,
		// Unreleased features the specs cover, behind their server gates.
		PUBLIC_SHARING_ENABLED: "true",
		COMMENTS_ENABLED: "true",
		FORKS_ENABLED: "true",
		TUNELO_ACCOUNTS_ENABLED: "true",
		LIVE_MOCK_SYNC_ENABLED: "true",
		TUNELO_API_URL: TUNELO_ORIGIN, // the fake Tunelo for every tenant
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

/** Flags production builds with (`infra/localman/released-features`). */
function releasedFeatures(): string[] {
	const file = resolve(REPO, "infra/localman/released-features");
	return readFileSync(file, "utf8")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "" && !line.startsWith("#"));
}

/** Specs that cover features not released yet turn their flags on here. */
const UNRELEASED_FEATURES = [
	"publicSharing",
	"comments",
	"forks",
	"tuneloAccounts",
	"liveMockSync",
];

/**
 * Production build of the web app for the E2E: same origin for the API
 * (empty VITE_API_BASE_URL), the local IdP for the account page, and the
 * production flags plus the unreleased ones under test.
 */
function webBuildEnv(): NodeJS.ProcessEnv {
	return {
		...baseEnv(),
		VITE_API_BASE_URL: "",
		VITE_IDP_ORIGIN: IDP_ORIGIN,
		VITE_FEATURES: [
			...new Set([...releasedFeatures(), ...UNRELEASED_FEATURES]),
		].join(","),
	};
}

/** A TypeScript entry of the repo run with tsx (API and the fakes). */
function startTsx(
	name: string,
	entry: string,
	env: NodeJS.ProcessEnv,
): Service {
	return startService(name, TSX, [entry], { cwd: REPO, env });
}

/** Starts MongoDB, the API, the fakes and the web preview; resolves when all answer. */
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
		// Tracked like the servers: a setup cancelled mid-build stops it too.
		const build = startService(
			"web build",
			process.execPath,
			[VITE, "build", "--outDir", relative(WEB_DIR, WEB_OUT), "--emptyOutDir"],
			{ cwd: WEB_DIR, env: webBuildEnv() },
		);
		services.push(build);
		await waitForSuccess(build);
		const mongoUri = mongo.getUri("localman_e2e");
		const api = startTsx("api", API_ENTRY, apiEnv(mongoUri, oidcSecret));
		const idp = startTsx("fake-idp", IDP_ENTRY, idpEnv(oidcSecret));
		const echo = startTsx("echo", ECHO_ENTRY, baseEnv());
		const tunelo = startTsx("fake-tunelo", TUNELO_ENTRY, baseEnv());
		services.push(api, idp, echo, tunelo);
		await waitForHttp(`${API_ORIGIN}/api/v1/openapi.json`, api);
		await waitForHttp(`http://127.0.0.1:${PORTS.mock}/healthz`, api);
		await waitForHttp(`${IDP_ORIGIN}/.well-known/openid-configuration`, idp);
		await waitForHttp(`${ECHO_ORIGIN}/health`, echo);
		await waitForHttp(`${TUNELO_ORIGIN}/__e2e/health`, tunelo);

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
