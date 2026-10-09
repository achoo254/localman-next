import { useState } from "react";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useT } from "../../i18n/i18n-context";
import type { SourceMessages } from "../../i18n/message-types";
import type { Translate } from "../../i18n/translate";
import { cn } from "../../lib/cn";
import {
	EVENT_CHANNELS,
	type EventChannel,
	type EventPreference,
	type NotificationChannels,
} from "./notification-preferences-api";

type EventTypeKey =
	`notifications.events.types.${keyof SourceMessages["notifications"]["events"]["types"]}`;

/** Labels the web knows for each API event `type`. */
const EVENT_TYPE_KEYS: Readonly<Record<string, EventTypeKey>> = {
	"project.invitation": "notifications.events.types.projectInvitation",
	"project.mockUrlChanged": "notifications.events.types.projectMockUrlChanged",
	"usage.quota": "notifications.events.types.usageQuota",
};

/** The event's label in the current language; a type unknown to this build keeps the API's label. */
function eventLabel(event: EventPreference, t: Translate): string {
	const key = Object.hasOwn(EVENT_TYPE_KEYS, event.type)
		? EVENT_TYPE_KEYS[event.type]
		: undefined;
	return key ? t(key) : event.label;
}

export interface EventPreferencesTableProps {
	events: EventPreference[];
	channels: NotificationChannels;
	/** Persists the draft; resolves once saved (errors are reported upstream). */
	onSave: (events: EventPreference[]) => Promise<void>;
}

function usableChannels(
	channels: NotificationChannels,
): Record<EventChannel, boolean> {
	return {
		// In-app is always deliverable; users may still mute it per event.
		inApp: true,
		webPush: channels.webPush.available,
		telegram: channels.telegram.available && channels.telegram.linked,
	};
}

/** Event type × channel matrix, saved with one PUT. */
export function EventPreferencesTable({
	events,
	channels,
	onSave,
}: EventPreferencesTableProps) {
	const t = useT();
	const [draft, setDraft] = useState(events);
	const [saving, setSaving] = useState(false);
	const usable = usableChannels(channels);
	const dirty = draft.some((event, index) =>
		EVENT_CHANNELS.some(
			(channel) => event[channel] !== events[index]?.[channel],
		),
	);

	function toggle(type: string, channel: EventChannel, value: boolean) {
		setDraft((current) =>
			current.map((event) =>
				event.type === type ? { ...event, [channel]: value } : event,
			),
		);
	}

	async function save() {
		setSaving(true);
		try {
			await onSave(draft);
		} finally {
			setSaving(false);
		}
	}

	return (
		<section
			data-id="notify-events"
			aria-labelledby="notify-events-title"
			className={cn(cardClassName, "grid gap-4 p-6")}
		>
			<h2
				id="notify-events-title"
				className="m-0 font-bold font-mono text-base"
			>
				{t("notifications.events.title")}
			</h2>
			{draft.length === 0 ? (
				<p className="m-0 text-muted text-sm">
					{t("notifications.events.empty")}
				</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="text-left font-mono text-muted text-xs">
								<th scope="col" className="py-2 pr-4 font-semibold">
									{t("notifications.events.event")}
								</th>
								{EVENT_CHANNELS.map((channel) => (
									<th
										key={channel}
										scope="col"
										className="px-2 py-2 text-center font-semibold"
									>
										{t(`notifications.channels.${channel}`)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{draft.map((event) => (
								<tr key={event.type} className="border-border-subtle border-t">
									<th scope="row" className="py-3 pr-4 text-left font-normal">
										{eventLabel(event, t)}
									</th>
									{EVENT_CHANNELS.map((channel) => (
										<td key={channel} className="px-2 py-3 text-center">
											<input
												type="checkbox"
												data-id={`notify-events-${event.type}-${channel}`}
												aria-label={t("notifications.events.cell", {
													event: eventLabel(event, t),
													channel: t(`notifications.channels.${channel}`),
												})}
												checked={event[channel]}
												disabled={!usable[channel] || saving}
												onChange={(e) =>
													toggle(event.type, channel, e.currentTarget.checked)
												}
												className="size-4 cursor-pointer accent-primary-solid disabled:cursor-not-allowed"
											/>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="m-0 text-[0.8125rem] text-muted">
				{t("notifications.events.note")}
			</p>
			<div>
				<Button
					variant="primary"
					data-id="notify-events-save"
					disabled={!dirty || saving}
					aria-busy={saving || undefined}
					onClick={() => void save()}
				>
					{t("notifications.events.save")}
				</Button>
			</div>
		</section>
	);
}
