import type { FetchCall, MockRoute } from "../../test/mock-fetch";

/**
 * `DELETE /collections/:id`: a dry run counts `requests` (as the server
 * does now), the real call moves it to the trash.
 */
export function trashRoute(requests: number): MockRoute {
	return ({ query }) =>
		query.get("dryRun") === "true"
			? {
					body: {
						dryRun: true,
						deleted: false,
						collectionId: "c1",
						name: "Orders",
						folders: 0,
						requests,
						purgeAt: "2026-11-10T00:00:00.000Z",
					},
				}
			: { body: { deleted: true } };
}

/** The real (not dry-run) DELETE calls. */
export const realDeletes = (calls: FetchCall[]) =>
	calls.filter((c) => c.method === "DELETE" && !c.query.has("dryRun"));
