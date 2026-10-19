import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	COMMENTS,
	comment,
	openComments,
	renderShop,
	thread,
} from "./comments-test-utils";

const OPEN = thread("t1", [comment("t1", "Rename this?")]);
const RESOLVED = thread("t9", [comment("t9", "Done")], {
	resolvedAt: "2026-10-16T02:00:00.000Z",
	resolvedBy: "u2",
});

describe("reopening a resolved thread", () => {
	it("sends the reopen request for that thread and shows it open again", async () => {
		let resolved = true;
		const { calls } = renderShop({
			[`GET ${COMMENTS}`]: ({ query }) => ({
				body: {
					threads:
						query.get("includeResolved") === "true"
							? [
									OPEN,
									{
										...RESOLVED,
										resolvedAt: resolved ? RESOLVED.resolvedAt : null,
									},
								]
							: [OPEN],
				},
			}),
			[`PUT ${COMMENTS}/t9/resolution`]: ({ body }) => {
				resolved = (body as { resolved: boolean }).resolved;
				return { body: {} };
			},
		});
		const user = await openComments();
		await user.click(screen.getByRole("checkbox", { name: "Show resolved" }));
		expect(await screen.findByText("Done")).toBeVisible();
		expect(screen.getByText("Resolved")).toBeVisible();

		await user.click(screen.getByRole("button", { name: "Reopen" }));

		await waitFor(() => {
			const reopen = calls.find(
				(c) => c.method === "PUT" && c.path === `${COMMENTS}/t9/resolution`,
			);
			expect(reopen?.body).toEqual({ resolved: false });
		});
		await waitFor(() =>
			expect(screen.queryByText("Resolved")).not.toBeInTheDocument(),
		);
		expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
	});
});
