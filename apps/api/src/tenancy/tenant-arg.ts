import { PRIMARY_TENANT_ID } from "./primary-tenant.js";

/** `primary` or the IdP's `ten_<16 base64url chars>`. */
const TENANT_ID = /^(?:primary|ten_[A-Za-z0-9_-]{16})$/;

/** The `--tenant` option of the ops commands (`parseArgs` shape). */
export const TENANT_OPTION = { tenant: { type: "string" } } as const;

/** `--tenant` checked; the primary tenant (hoandat.com) when absent. */
export function tenantIdArg(value: string | undefined): string {
	const tenantId = value ?? PRIMARY_TENANT_ID;
	if (!TENANT_ID.test(tenantId)) {
		throw new Error("--tenant must be primary or a ten_… tenant id");
	}
	return tenantId;
}
