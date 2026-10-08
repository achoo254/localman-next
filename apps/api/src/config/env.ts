import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65_535);

const envSchema = z
	.object({
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		DASHBOARD_PORT: port.default(4000),
		MOCK_PORT: port.default(4100),
		MONGO_URI: z
			.string({ error: "is required" })
			.regex(
				/^mongodb(\+srv)?:\/\/\S+$/,
				"must be a mongodb:// or mongodb+srv:// URI",
			),
		WEB_ORIGIN: z
			.url({ protocol: /^https?$/, error: "must be an http(s) origin" })
			.default("http://localhost:5173"),
		LOG_LEVEL: z
			.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
			.default("info"),
	})
	.refine((env) => env.DASHBOARD_PORT !== env.MOCK_PORT, {
		path: ["MOCK_PORT"],
		error: "must differ from DASHBOARD_PORT",
	});

export type Env = z.output<typeof envSchema>;

export class EnvError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EnvError";
	}
}

/**
 * Validates configuration from the environment. Empty values count as unset
 * so `KEY=` in a .env file falls back to the default. Error messages name the
 * variable but never echo its value, which may be a secret.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
	const defined = Object.fromEntries(
		Object.entries(source).filter(([, value]) => value !== ""),
	);
	const result = envSchema.safeParse(defined);
	if (result.success) return result.data;
	const lines = result.error.issues.map(
		(issue) => `  - ${issue.path.join(".") || "(env)"}: ${issue.message}`,
	);
	throw new EnvError(`Invalid environment configuration:\n${lines.join("\n")}`);
}
