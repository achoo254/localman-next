import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PORTS } from "./ports.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const TSX = resolve(REPO, "node_modules/.bin/tsx");
const SET_USER_PLAN = resolve(REPO, "apps/api/scripts/set-user-plan.ts");
const MONGO_URI = `mongodb://127.0.0.1:${PORTS.mongo}/localman_e2e?directConnection=true`;
const run = promisify(execFile);

/**
 * Ends the 30 days of Pro every new account gets at sign-in, through the
 * admin CLI: the account keeps its used trial and counts as Free from its
 * next request (the plan is read per request; reload the page for the
 * web app to see it).
 */
export async function endProPeriod(username: string): Promise<void> {
	await run(TSX, [SET_USER_PLAN, "--username", username, "--plan", "free"], {
		cwd: REPO,
		env: {
			PATH: process.env.PATH ?? "",
			HOME: process.env.HOME ?? "",
			MONGO_URI,
		},
	});
}
