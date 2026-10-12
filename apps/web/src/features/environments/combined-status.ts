import type { SaveStatus } from "../collections/use-page-autosave";

const RANK: Record<SaveStatus["state"], number> = {
	idle: 0,
	saved: 1,
	saving: 2,
	error: 3,
};

/** One status for two saves: an error, else saving, else saved. */
export function combinedStatus(a: SaveStatus, b: SaveStatus): SaveStatus {
	return RANK[b.state] > RANK[a.state] ? b : a;
}
