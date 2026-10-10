import { IconArrowsMinimize, IconZoomReset } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { Tooltip } from "../../components/ui/tooltip";
import { useT } from "../../i18n/i18n-context";
import type { ZoomMode } from "./use-canvas-zoom";

export interface ZoomToolbarProps {
	mode: ZoomMode;
	onFit: () => void;
	onActual: () => void;
	/** `data-id` of the group; buttons append `-fit` and `-actual`. */
	"data-id": string;
}

/** "Fit" and "100%" of the tree canvas, with their Shift+1 / Shift+0 keys. */
export function ZoomToolbar({
	mode,
	onFit,
	onActual,
	"data-id": dataId,
}: ZoomToolbarProps) {
	const t = useT();
	return (
		<fieldset
			data-id={dataId}
			className="m-0 flex min-w-0 flex-none items-center gap-1 border-0 p-0"
		>
			<legend className="sr-only">{t("resourceTree.zoom.label")}</legend>
			<Tooltip content={t("resourceTree.zoom.fitHint")}>
				<Button
					variant="ghost"
					size="sm"
					aria-pressed={mode === "fit"}
					aria-keyshortcuts="Shift+1"
					data-id={`${dataId}-fit`}
					leadingIcon={<IconArrowsMinimize size={16} aria-hidden="true" />}
					className="aria-pressed:bg-fg/6 aria-pressed:text-fg"
					onClick={onFit}
				>
					{t("resourceTree.zoom.fit")}
				</Button>
			</Tooltip>
			<Tooltip content={t("resourceTree.zoom.actualHint")}>
				<Button
					variant="ghost"
					size="sm"
					aria-pressed={mode === "actual"}
					aria-keyshortcuts="Shift+0"
					data-id={`${dataId}-actual`}
					leadingIcon={<IconZoomReset size={16} aria-hidden="true" />}
					className="aria-pressed:bg-fg/6 aria-pressed:text-fg"
					onClick={onActual}
				>
					100%
				</Button>
			</Tooltip>
		</fieldset>
	);
}
