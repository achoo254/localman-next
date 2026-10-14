import type { SecretLikeValue } from "@localman/shared/api-client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

interface Pending<I> {
	input: I;
	warnings: SecretLikeValue[];
}

/**
 * Publishing in two steps: a dry run lists the secret-looking places, the
 * caller confirms, then the real call publishes. `run(input, dryRun)` is
 * the API call; `onPublished` gets the real answer.
 */
export function usePublishFlow<I, R extends { warnings: SecretLikeValue[] }>(
	run: (input: I, dryRun: boolean) => Promise<R>,
	onPublished: (result: R, input: I) => void,
) {
	const [pending, setPending] = useState<Pending<I> | null>(null);
	const check = useMutation({
		mutationFn: (input: I) => run(input, true),
		onSuccess: (result, input) =>
			setPending({ input, warnings: result.warnings }),
	});
	const publish = useMutation({
		mutationFn: (input: I) => run(input, false),
		onSuccess: (result, input) => {
			setPending(null);
			onPublished(result, input);
		},
	});
	return {
		/** The confirm step is open with these warnings. */
		pending,
		checking: check.isPending,
		publishing: publish.isPending,
		/** The dry run failed: nothing to confirm. */
		checkError: check.error,
		/** The real call failed: shown in the confirm step. */
		publishError: publish.error,
		start(input: I) {
			if (check.isPending || publish.isPending) return;
			publish.reset();
			check.mutate(input);
		},
		confirm() {
			if (pending && !publish.isPending) publish.mutate(pending.input);
		},
		cancel() {
			if (publish.isPending) return;
			setPending(null);
			publish.reset();
		},
	};
}
