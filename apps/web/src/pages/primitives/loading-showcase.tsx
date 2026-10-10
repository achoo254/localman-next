import { IconDeviceFloppy, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { PanelProgress } from "../../components/ui/panel-progress";
import { Skeleton } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { ShowcaseSection } from "./showcase-section";

/** How long the demo save and refresh pretend to wait for the server. */
const DEMO_MS = 1500;

/** Sample request paths in the refresh demo (code, not translated). */
const SAMPLE_PATHS = ["GET /users", "POST /orders", "DELETE /carts/42"];

/** `true` for `DEMO_MS` after `start()`, like a request in flight. */
function useDemoPending(): [boolean, () => void] {
	const [pending, setPending] = useState(false);
	useEffect(() => {
		if (!pending) return;
		const timer = window.setTimeout(() => setPending(false), DEMO_MS);
		return () => window.clearTimeout(timer);
	}, [pending]);
	return [pending, () => setPending(true)];
}

export function LoadingShowcase() {
	const t = useT();
	const [saving, save] = useDemoPending();
	const [refreshing, refresh] = useDemoPending();
	return (
		<ShowcaseSection
			dataId="primitives-loading"
			title={t("primitives.loading.title")}
			description={t("primitives.loading.description")}
		>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					variant="primary"
					loading={saving}
					leadingIcon={<IconDeviceFloppy size={16} aria-hidden="true" />}
					data-id="primitives-loading-save"
					onClick={save}
				>
					{t("primitives.loading.save")}
				</Button>
				<Button loading data-id="primitives-loading-busy">
					{t("primitives.loading.busy")}
				</Button>
				<IconButton
					loading
					label={t("primitives.loading.busyIcon")}
					icon={<IconRefresh size={18} aria-hidden="true" />}
					data-id="primitives-loading-icon"
				/>
			</div>
			<figure className="m-0 grid gap-2" data-id="primitives-loading-skeleton">
				<div className="flex items-center gap-3 rounded-lg border border-border p-4">
					<Skeleton variant="circle" className="size-11 shrink-0" />
					<div className="grid min-w-0 flex-1 gap-2">
						<Skeleton className="h-4 w-40 max-w-full" />
						<Skeleton variant="text" lines={2} className="max-w-md" />
					</div>
				</div>
				<figcaption className="text-muted text-sm">
					{t("primitives.loading.skeletonCaption")}
				</figcaption>
			</figure>
			<div className="grid gap-2">
				<PanelProgress
					active={refreshing}
					dim
					aria-busy={refreshing || undefined}
					data-id="primitives-loading-panel"
					className="overflow-hidden rounded-lg border border-border"
				>
					<ul className="m-0 grid list-none gap-2 p-4 font-mono text-sm">
						{SAMPLE_PATHS.map((path) => (
							<li key={path}>{path}</li>
						))}
					</ul>
				</PanelProgress>
				<div className="flex flex-wrap items-center gap-3">
					<Button
						size="sm"
						leadingIcon={<IconRefresh size={16} aria-hidden="true" />}
						data-id="primitives-loading-refresh"
						onClick={refresh}
					>
						{t("primitives.loading.refresh")}
					</Button>
					<span className="text-muted text-sm">
						{t("primitives.loading.panelCaption")}
					</span>
				</div>
			</div>
		</ShowcaseSection>
	);
}
