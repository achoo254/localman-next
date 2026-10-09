import { useState } from "react";
import { Button } from "../../components/ui/button";
import {
	EVENT_CHANNELS,
	type EventChannel,
	type EventPreference,
	type NotificationChannels,
} from "./notification-preferences-api";

const CHANNEL_LABEL: Record<EventChannel, string> = {
	inApp: "Trong app",
	webPush: "Web Push",
	telegram: "Telegram",
};

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
			className="grid gap-4 rounded-lg border border-border bg-surface p-6"
		>
			<h2
				id="notify-events-title"
				className="m-0 font-bold font-mono text-base"
			>
				Nhận thông báo theo loại sự kiện
			</h2>
			{draft.length === 0 ? (
				<p className="m-0 text-muted text-sm">Chưa có loại sự kiện nào.</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="text-left font-mono text-muted text-xs">
								<th scope="col" className="py-2 pr-4 font-semibold">
									Sự kiện
								</th>
								{EVENT_CHANNELS.map((channel) => (
									<th
										key={channel}
										scope="col"
										className="px-2 py-2 text-center font-semibold"
									>
										{CHANNEL_LABEL[channel]}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{draft.map((event) => (
								<tr key={event.type} className="border-border-subtle border-t">
									<th scope="row" className="py-3 pr-4 text-left font-normal">
										{event.label}
									</th>
									{EVENT_CHANNELS.map((channel) => (
										<td key={channel} className="px-2 py-3 text-center">
											<input
												type="checkbox"
												data-id={`notify-events-${event.type}-${channel}`}
												aria-label={`${event.label}: ${CHANNEL_LABEL[channel]}`}
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
				Ô bị khoá khi kênh chưa sẵn sàng. Không có kênh email: hoandat không gửi
				email.
			</p>
			<div>
				<Button
					variant="primary"
					data-id="notify-events-save"
					disabled={!dirty || saving}
					aria-busy={saving || undefined}
					onClick={() => void save()}
				>
					Lưu tuỳ chọn
				</Button>
			</div>
		</section>
	);
}
