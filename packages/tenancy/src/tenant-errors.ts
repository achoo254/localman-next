export class MissingTenantError extends Error {
	constructor() {
		super("No tenant in scope for a tenant-owned collection");
		this.name = "MissingTenantError";
	}
}

export class CrossTenantWriteError extends Error {
	constructor() {
		super("A write cannot move documents to or from another tenant");
		this.name = "CrossTenantWriteError";
	}
}
