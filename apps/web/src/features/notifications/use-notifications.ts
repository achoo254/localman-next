import { useCallback, useEffect, useRef, useState } from "react";
import {
	type AppNotification,
	fetchNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "./notifications-api";
import { onNotificationsChanged } from "./notifications-changed";

export interface NotificationsState {
	items: AppNotification[];
	unreadCount: number;
	nextCursor: string | null;
	/** First page or a refresh is on its way. */
	loading: boolean;
	/** "Show more" is fetching the next page. */
	loadingMore: boolean;
	error: unknown;
}

const INITIAL: NotificationsState = {
	items: [],
	unreadCount: 0,
	nextCursor: null,
	loading: true,
	loadingMore: false,
	error: null,
};

/** The items with `ids` set to `readAt` (read, or back to unread with `null`). */
function withReadAt(
	items: AppNotification[],
	ids: ReadonlySet<string>,
	readAt: string | null,
): AppNotification[] {
	return items.map((item) => (ids.has(item.id) ? { ...item, readAt } : item));
}

/**
 * Bell data: first page on mount, `refresh` when the menu opens or another
 * part of the app announces a change, `loadMore` for the next cursor.
 * Mark-read calls show the change at once and put it back if the server
 * refuses; failures reject so the caller can tell the user.
 */
export function useNotifications() {
	const [state, setState] = useState<NotificationsState>(INITIAL);
	const latest = useRef(state);
	latest.current = state;

	const refresh = useCallback(async () => {
		setState((s) => ({ ...s, loading: true, error: null }));
		try {
			const page = await fetchNotifications(null);
			setState((s) => ({ ...s, ...page, loading: false, error: null }));
		} catch (error) {
			setState((s) => ({ ...s, loading: false, error }));
		}
	}, []);

	const loadMore = useCallback(async () => {
		const cursor = state.nextCursor;
		if (!cursor) return;
		setState((s) => ({ ...s, loadingMore: true }));
		try {
			const page = await fetchNotifications(cursor);
			setState((s) => {
				const known = new Set(s.items.map((item) => item.id));
				const fresh = page.items.filter((item) => !known.has(item.id));
				return {
					...s,
					items: [...s.items, ...fresh],
					unreadCount: page.unreadCount,
					nextCursor: page.nextCursor,
					loadingMore: false,
					error: null,
				};
			});
		} catch (error) {
			setState((s) => ({ ...s, loadingMore: false, error }));
		}
	}, [state.nextCursor]);

	/** Shows `ids` read and `count` fewer unread now; undoes both on failure. */
	const readOptimistically = useCallback(
		async (
			ids: ReadonlySet<string>,
			count: number,
			request: () => Promise<void>,
		) => {
			const readAt = new Date().toISOString();
			setState((s) => ({
				...s,
				items: withReadAt(s.items, ids, readAt),
				unreadCount: Math.max(0, s.unreadCount - count),
			}));
			try {
				await request();
			} catch (error) {
				setState((s) => ({
					...s,
					items: withReadAt(s.items, ids, null),
					unreadCount: s.unreadCount + count,
				}));
				throw error;
			}
		},
		[],
	);

	const markRead = useCallback(
		async (id: string) => {
			const target = latest.current.items.find((item) => item.id === id);
			if (!target || target.readAt !== null) {
				await markNotificationRead(id);
				return;
			}
			await readOptimistically(new Set([id]), 1, () =>
				markNotificationRead(id),
			);
		},
		[readOptimistically],
	);

	const markAllRead = useCallback(async () => {
		const { items, unreadCount } = latest.current;
		const unread = items.filter((item) => item.readAt === null);
		await readOptimistically(
			new Set(unread.map((item) => item.id)),
			unreadCount,
			markAllNotificationsRead,
		);
	}, [readOptimistically]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => onNotificationsChanged(() => void refresh()), [refresh]);

	return { ...state, refresh, loadMore, markRead, markAllRead };
}
