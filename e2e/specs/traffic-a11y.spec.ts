import { expect, test } from "@playwright/test";
import { axeViolations } from "../support/axe.js";
import {
	type EndpointTab,
	openEndpointTab,
	seedProjectWithUsers,
} from "../support/traffic-ui.js";

const TABS: readonly EndpointTab[] = ["upstream", "log", "inbox"];

test("the upstream, request log and inbox tabs have no serious or critical axe violations", async ({
	page,
	request,
}) => {
	const { usersUrl } = await seedProjectWithUsers(page, "axe");
	// One logged call, so the request log table holds a row to scan.
	const reply = await request.get(usersUrl);
	expect(reply.status()).toBe(200);

	const found: Record<string, string[]> = {};
	for (const tab of TABS) {
		await openEndpointTab(page, tab);
		const serious = (await axeViolations(page)).filter(
			(finding) =>
				finding.impact === "serious" || finding.impact === "critical",
		);
		found[tab] = serious.map(
			(finding) =>
				`${finding.id} (${finding.impact}, ${finding.nodes} nodes): ${finding.targets.join(", ")}`,
		);
	}
	expect(found).toEqual({ upstream: [], log: [], inbox: [] });
});
