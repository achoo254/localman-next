import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { EventPreferencesTable } from "./event-preferences-table";
import type { NotificationChannels } from "./notification-preferences-api";

const CHANNELS: NotificationChannels = {
	webPush: { available: true, enabled: false },
	telegram: {
		available: false,
		linked: false,
		activated: false,
		botUsername: null,
	},
};

const event = (type: string, label: string) => ({
	type,
	label,
	inApp: true,
	webPush: false,
	telegram: false,
});

describe("EventPreferencesTable", () => {
	it("names a known event type in the current language, not the API's", () => {
		render(
			<EventPreferencesTable
				events={[event("project.invitation", "Lời mời cộng tác project")]}
				channels={CHANNELS}
				onToggle={() => {}}
			/>,
		);
		expect(
			screen.getByRole("rowheader", {
				name: "Project collaboration invitations",
			}),
		).toBeVisible();
		expect(
			screen.getByRole("checkbox", {
				name: "Project collaboration invitations: In app",
			}),
		).toBeChecked();
	});

	it("keeps the API label of an event type this build does not know", () => {
		render(
			<EventPreferencesTable
				events={[event("billing.renewal", "Plan renewal")]}
				channels={CHANNELS}
				onToggle={() => {}}
			/>,
		);
		expect(
			screen.getByRole("rowheader", { name: "Plan renewal" }),
		).toBeVisible();
	});

	it.each([
		[true, 5],
		[false, 1],
	])(
		"shows the four sharing events only with workspaces (%s)",
		(workspaces, rows) => {
			render(
				<FeaturesContext
					value={{ ...NO_FEATURES, apiClient: true, workspaces }}
				>
					<EventPreferencesTable
						events={[
							event("project.invitation", "Project invitations"),
							event("workspace.invitation", "Workspace invitations"),
							event("element.shared", "Shared"),
							event("access.requested", "Requested"),
							event("access.resolved", "Resolved"),
						]}
						channels={CHANNELS}
						onToggle={() => {}}
					/>
				</FeaturesContext>,
			);
			expect(screen.getAllByRole("rowheader")).toHaveLength(rows);
			const requested = screen.queryByRole("rowheader", {
				name: "Requests for access to your items",
			});
			if (workspaces) expect(requested).toBeVisible();
			else expect(requested).toBeNull();
		},
	);
});
