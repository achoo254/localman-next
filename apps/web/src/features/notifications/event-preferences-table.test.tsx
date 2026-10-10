import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
