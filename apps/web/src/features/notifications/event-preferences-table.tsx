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
	/** A box was ticked: saved at once, flipped back upstream if refused. */
	onToggle: (type: string, channel: EventChannel, value: boolean) => void;
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

/** Event type × channel matrix; each box saves as soon as it changes. */
export function EventPreferencesTable({
	events,
	channels,
	onToggle,
}: EventPreferencesTableProps) {
	const t = useT();
	const usable = usableChannels(channels);

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
			{events.length === 0 ? (
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
							{events.map((event) => (
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
												disabled={!usable[channel]}
												onChange={(e) =>
													onToggle(event.type, channel, e.currentTarget.checked)
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
		</section>
	);
}
