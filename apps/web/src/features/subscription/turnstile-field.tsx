import {
	TURNSTILE_ACTIONS,
	type TurnstileAction,
} from "@localman/shared/constants";
import { useEffect, useRef, useState } from "react";
import { loadTurnstile } from "../../platform/turnstile";

export interface TurnstileFieldProps {
	siteKey: string;
	/** Current token, or null when none is valid. */
	onTokenChange: (token: string | null) => void;
	error?: string;
	errorId: string;
	/** Form the token is for; the API refuses it on another form. */
	action?: TurnstileAction;
	/** `data-id` of the widget block. */
	dataId?: string;
}

/**
 * Cloudflare Turnstile challenge for visitors who are not signed in. Remount
 * it (change its `key`) to get a fresh token after a failed submission:
 * tokens are single use.
 */
export function TurnstileField({
	siteKey,
	onTokenChange,
	error,
	errorId,
	action = TURNSTILE_ACTIONS.proInterest,
	dataId = "pro-interest-turnstile",
}: TurnstileFieldProps) {
	const container = useRef<HTMLDivElement>(null);
	const onChange = useRef(onTokenChange);
	onChange.current = onTokenChange;
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		const element = container.current;
		if (!element) return;
		let disposed = false;
		let remove: (() => void) | null = null;
		loadTurnstile().then(
			(client) => {
				if (disposed) return;
				const id = client.render(element, siteKey, {
					onToken: (token) => onChange.current(token),
					onReset: () => onChange.current(null),
					action,
				});
				remove = () => client.remove(id);
			},
			() => {
				if (!disposed) setFailed(true);
			},
		);
		return () => {
			disposed = true;
			remove?.();
			onChange.current(null);
		};
	}, [siteKey, action]);

	return (
		<div data-id={dataId} className="grid gap-1.5">
			<div ref={container} aria-describedby={error ? errorId : undefined} />
			{failed ? (
				<p className="text-[0.8125rem] text-error">
					Không tải được bước xác minh. Kiểm tra kết nối rồi mở lại form.
				</p>
			) : null}
			{error ? (
				<p id={errorId} className="text-[0.8125rem] text-error">
					{error}
				</p>
			) : null}
		</div>
	);
}
