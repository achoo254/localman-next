import { type ComponentType, Suspense, lazy } from "react";
import { PageLoading } from "../components/layout/page-loading";
import { RouteChunkPending } from "../components/ui/route-progress";

/**
 * Page code split into its own chunk, loaded on first visit. The
 * prerendered landing and the shell (header, guards) stay
 * in the main chunk so the first paint and the session check do not wait
 * for a second request. While the chunk loads, the fallback lights the
 * window's route bar and shows the generic page skeleton.
 */
export function lazyPage<K extends string>(
	load: () => Promise<Record<K, ComponentType>>,
	name: K,
) {
	const Page = lazy(async () => {
		const page: ComponentType = (await load())[name];
		return { default: page };
	});
	return (
		<Suspense
			fallback={
				<>
					<RouteChunkPending />
					<PageLoading />
				</>
			}
		>
			<Page />
		</Suspense>
	);
}
