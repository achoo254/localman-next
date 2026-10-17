import { useCallback, useRef, useState } from "react";

interface Pending<Ask, Answer> {
	ask: Ask;
	resolve: (answer: Answer) => void;
}

export interface AskQueue<Ask, Answer> {
	/** The question on screen; `null` when none is waiting. */
	current: Ask | null;
	/**
	 * Queues a question; resolves with the user's answer, or `declined`
	 * when `signal` aborts first (the send was cancelled or its tab closed).
	 * Stable for the component's life.
	 */
	ask: (question: Ask, signal: AbortSignal) => Promise<Answer>;
	/** Answers the question on screen; the next one shows. */
	answer: (answer: Answer) => void;
}

/**
 * Questions the router asks during sends (consent, which tunnel): several
 * tabs may ask at once, so one modal shows them in order.
 */
export function useAskQueue<Ask, Answer>(
	declined: Answer,
): AskQueue<Ask, Answer> {
	const queue = useRef<Pending<Ask, Answer>[]>([]);
	const [current, setCurrent] = useState<Pending<Ask, Answer> | null>(null);
	const declinedRef = useRef(declined);

	const ask = useCallback(
		(question: Ask, signal: AbortSignal) =>
			new Promise<Answer>((resolve) => {
				const pending: Pending<Ask, Answer> = {
					ask: question,
					resolve: (answer) => {
						signal.removeEventListener("abort", onAbort);
						queue.current = queue.current.filter((item) => item !== pending);
						setCurrent(queue.current[0] ?? null);
						resolve(answer);
					},
				};
				const onAbort = () => pending.resolve(declinedRef.current);
				signal.addEventListener("abort", onAbort, { once: true });
				queue.current = [...queue.current, pending];
				setCurrent(queue.current[0] ?? null);
			}),
		[],
	);

	return {
		current: current?.ask ?? null,
		ask,
		answer: (answer) => current?.resolve(answer),
	};
}
