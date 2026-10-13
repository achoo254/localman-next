import { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tunnel-tenant.js";

const usageLogSchema = new Schema({
	// A key's ObjectId as hex, or an account `sub` for identity-provider
	// tokens (not an ObjectId, which used to make the whole flush fail).
	keyId: { type: String, required: true },
	userId: { type: String, required: true },
	date: { type: String, required: true }, // "YYYY-MM-DD"
	requestCount: { type: Number, default: 0 },
	bytesIn: { type: Number, default: 0 },
	bytesOut: { type: Number, default: 0 },
});

usageLogSchema.index({ userId: 1, date: 1 });
usageLogSchema.index({ keyId: 1, date: 1 });
usageLogSchema.index({ date: 1 });

usageLogSchema.plugin(tenantScopePlugin);
export const UsageLog = model("UsageLog", usageLogSchema);
