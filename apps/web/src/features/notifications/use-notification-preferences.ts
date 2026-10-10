import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../components/ui/toast";
import { errorMessage } from "../../lib/api-client";
import {
	type EventChannel,
	type EventPreference,
	type NotificationPreferences,
	fetchPreferences,
	savePreferences,
} from "./notification-preferences-api";

export type PreferencesState =
	| { status: "loading" }
	| { status: "ready"; value: NotificationPreferences }
	| { status: "error"; error: unknown };

/** The events with one event type's channel turned on or off. */
export function withChoice(
	events: readonly EventPreference[],
	type: string,
	channel: EventChannel,
	value: boolean,
): EventPreference[] {
	return events.map((event) =>
		event.type === type ? { ...event, [channel]: value } : event,
	);
}

/**
 * Notification preferences of `/account/notifications`. A box ticked in
 * the event table shows at once and is saved with one PUT of every
 * event; if the server refuses, that box flips back with an error toast.
 * The server's answer is applied once no other save is running, so an
 * earlier answer never undoes a later tick.
 */
export function useNotificationPreferences() {
	const toast = useToast();
	const [state, setState] = useState<PreferencesState>({ status: "loading" });
	const saving = useRef(0);

	const load = useCallback(async () => {
		setState({ status: "loading" });
		try {
			setState({ status: "ready", value: await fetchPreferences() });
		} catch (error) {
			setState({ status: "error", error });
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const setEvents = useCallback(
		(edit: (events: EventPreference[]) => EventPreference[]) =>
			setState((s) =>
				s.status === "ready"
					? { ...s, value: { ...s.value, events: edit(s.value.events) } }
					: s,
			),
		[],
	);

	const toggleEvent = useCallback(
		async (type: string, channel: EventChannel, value: boolean) => {
			if (state.status !== "ready") return;
			const events = withChoice(state.value.events, type, channel, value);
			setEvents(() => events);
			saving.current += 1;
			try {
				const saved = await savePreferences(events);
				saving.current -= 1;
				if (saving.current === 0) setState({ status: "ready", value: saved });
			} catch (error) {
				saving.current -= 1;
				setEvents((current) => withChoice(current, type, channel, !value));
				toast.show({ tone: "error", title: errorMessage(error) });
			}
		},
		[state, setEvents, toast],
	);

	/** A test reached the bot or got a 403: show or hide the Start reminder. */
	const setTelegramActivated = useCallback((activated: boolean) => {
		setState((s) => {
			if (s.status !== "ready") return s;
			const { channels } = s.value;
			const telegram = { ...channels.telegram, activated };
			return {
				...s,
				value: { ...s.value, channels: { ...channels, telegram } },
			};
		});
	}, []);

	return { state, load, toggleEvent, setTelegramActivated };
}
