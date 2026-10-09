/**
 * Admin CLI until billing exists: sets a user's plan and its expiry.
 *   MONGO_URI=… pnpm --filter @localman/api set-user-plan \
 *     --username dat --plan pro --expires 2026-12-31
 * `--expires` is inclusive (end of that day, Asia/Saigon); a past date
 * needs `--force`. Prints the user's sub, username and plan; never the URI
 * or the email.
 */
import mongoose from "mongoose";
import {
	parseSetUserPlanArgs,
	setUserPlan,
} from "../src/modules/billing/set-user-plan-command.js";

function fail(message: string, code: number): never {
	process.stderr.write(`${message}\n`);
	process.exit(code);
}

let args: ReturnType<typeof parseSetUserPlanArgs>;
try {
	args = parseSetUserPlanArgs(process.argv.slice(2));
} catch (error) {
	fail(error instanceof Error ? error.message : String(error), 2);
}

const uri = process.env.MONGO_URI ?? "";
if (!/^mongodb(\+srv)?:\/\/\S+$/.test(uri)) {
	fail("MONGO_URI must be set to a mongodb:// URI", 2);
}

try {
	await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
	const result = await setUserPlan(args);
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	await mongoose.disconnect();
} catch (error) {
	await mongoose.disconnect().catch(() => undefined);
	const reason = error instanceof Error ? error.message : String(error);
	fail(`set-user-plan failed: ${reason}`, 1);
}
