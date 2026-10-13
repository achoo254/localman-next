// Generates a Tunelo access token and stores its hash in MongoDB.
// The plaintext token is printed ONCE — copy it, it is not recoverable.
//
// Run where mongoose is installed and MONGO_URI is set, e.g. on the server:
//   cd /var/www/tunelo && node --env-file=.env create-access-token.mjs [label]
// The token belongs to tenant TENANT_ID (default: the primary tenant).
//
// Standalone on purpose (no build step / workspace imports) so it can run
// against the deployed server's node_modules.
import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";

const uri = process.env.MONGO_URI;
if (!uri) {
	console.error("MONGO_URI env var required");
	process.exit(1);
}

const label =
	process.argv[2] ?? `token-${new Date().toISOString().slice(0, 10)}`;
const maxTunnels = Number(process.env.MAX_TUNNELS ?? 3);
const tenantId = process.env.TENANT_ID ?? "primary";

// Matches apps/tunelo-server/src/db/models/api-key-model.ts (collection: apikeys).
// The server owns the indexes (unique per tenant): never build them here.
const schema = new mongoose.Schema(
	{
		tenantId: { type: String, required: true },
		userId: { type: mongoose.Schema.Types.ObjectId, default: null },
		keyHash: { type: String, required: true },
		keyPrefix: { type: String, required: true },
		label: { type: String, default: "Default" },
		status: { type: String, enum: ["active", "revoked"], default: "active" },
		maxTunnels: { type: Number, default: 3 },
		expiresAt: { type: Date, default: null },
		lastUsedAt: { type: Date, default: null },
	},
	{ timestamps: { createdAt: true, updatedAt: false }, autoIndex: false },
);
const TokenModel = mongoose.model("ApiKey", schema);

const token = `tunelo_${randomBytes(24).toString("hex")}`;
const keyHash = createHash("sha256").update(token).digest("hex");
const keyPrefix = token.slice(0, 12);

await mongoose.connect(uri);
await TokenModel.create({
	tenantId,
	keyHash,
	keyPrefix,
	label,
	status: "active",
	maxTunnels,
});
await mongoose.disconnect();

console.log("Access token created (copy now — not recoverable):");
console.log(token);
console.log(`label=${label} maxTunnels=${maxTunnels} tenant=${tenantId}`);
