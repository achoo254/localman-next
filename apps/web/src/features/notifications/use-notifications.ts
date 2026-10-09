import { useCallback, useEffect, useState } from "react";
import {
	type AppNotification,
	fetchNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "./notifications-api";

export interface NotificationsState {
	items: AppNotification[];
	unreadCount: number;
	nextCursor: string | null;
	loading: boolean;
	error: unknown;
}

const INITIAL: NotificationsState = {
	items: [],
	unreadCount: 0,
	nextCursor: null,
	loading: true,
	error: null,
};

/**
 * Bell data: first page on mount, `refresh` when the menu opens, `loadMore`
 * for the next cursor. Mark-read calls update local state once the server
 * confirms; failures reject so the caller can tell the user.
 */
export function useNotifications() {
	const [state, setState] = useState<NotificationsState>(INITIAL);

	const refresh = useCallback(async () => {
		setState((s) => ({ ...s, loading: true, error: null }));
		try {
			const page = await fetchNotifications(null);
			setState({ ...page, loading: false, error: null });
		} catch (error) {
			setState((s) => ({ ...s, loading: false, error }));
		}
	}, []);

	const loadMore = useCallback(async () => {
		const cursor = state.nextCursor;
		if (!cursor) return;
		setState((s) => ({ ...s, loading: true }));
		try {
			const page = await fetchNotifications(cursor);
			setState((s) => {
				const known = new Set(s.items.map((item) => item.id));
				const fresh = page.items.filter((item) => !known.has(item.id));
				return {
					items: [...s.items, ...fresh],
					unreadCount: page.unreadCount,
					nextCursor: page.nextCursor,
					loading: false,
					error: null,
				};
			});
		} catch (error) {
			setState((s) => ({ ...s, loading: false, error }));
		}
	}, [state.nextCursor]);

	const markRead = useCallback(async (id: string) => {
		await markNotificationRead(id);
		const readAt = new Date().toISOString();
		setState((s) => {
			const target = s.items.find((item) => item.id === id);
			if (!target || target.readAt) return s;
			return {
				...s,
				items: s.items.map((item) =>
					item.id === id ? { ...item, readAt } : item,
				),
				unreadCount: Math.max(0, s.unreadCount - 1),
			};
		});
	}, []);

	const markAllRead = useCallback(async () => {
		await markAllNotificationsRead();
		const readAt = new Date().toISOString();
		setState((s) => ({
			...s,
			items: s.items.map((item) => ({
				...item,
				readAt: item.readAt ?? readAt,
			})),
			unreadCount: 0,
		}));
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { ...state, refresh, loadMore, markRead, markAllRead };
}
