import { useEffect, useState } from "react";
import {
	type TurnstileConfig,
	fetchTurnstileConfig,
} from "./turnstile-config-api";

export type TurnstileConfigState =
	| { status: "loading" }
	| { status: "ready"; config: TurnstileConfig }
	| { status: "error"; error: unknown };

const NO_CHECK: TurnstileConfigState = {
	status: "ready",
	config: { turnstileSiteKey: null },
};

/**
 * Turnstile site key of the public forms, fetched for visitors only
 * (signed-in users are not challenged). `retry` fetches it again.
 */
export function useTurnstileConfig(signedIn: boolean): {
	state: TurnstileConfigState;
	retry: () => void;
} {
	const [state, setState] = useState<TurnstileConfigState>(
		signedIn ? NO_CHECK : { status: "loading" },
	);
	const [attempt, setAttempt] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger, read by nothing else.
	useEffect(() => {
		if (signedIn) {
			setState(NO_CHECK);
			return;
		}
		// Also runs when a session turns out to have expired.
		setState((current) =>
			current.status === "loading" ? current : { status: "loading" },
		);
		let active = true;
		fetchTurnstileConfig().then(
			(config) => active && setState({ status: "ready", config }),
			(error: unknown) => active && setState({ status: "error", error }),
		);
		return () => {
			active = false;
		};
	}, [signedIn, attempt]);

	return {
		state,
		retry: () => {
			setState({ status: "loading" });
			setAttempt((n) => n + 1);
		},
	};
}
