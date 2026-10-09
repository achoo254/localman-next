import { IconLoader2, IconSend } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { useT } from "../../../i18n/i18n-context";
import { renderRich } from "../../../i18n/rich-text";

const CENTERED =
	"grid flex-1 content-center justify-items-center gap-3 px-6 py-12 text-center";

/** Before the first send of the tab. */
export function ResponseEmpty({ note }: { note?: ReactNode }) {
	const t = useT();
	return (
		<div data-id="response-empty" className={CENTERED}>
			<IconSend size={32} aria-hidden="true" className="text-icon-muted" />
			<h2 className="m-0 font-bold font-mono text-base">
				{t("apiClientTools.response.empty.title")}
			</h2>
			<p className="m-0 max-w-90 text-muted text-sm">
				{renderRich(t("apiClientTools.response.empty.hint"))}
			</p>
			{note ? (
				<div data-id="response-empty-route" className="text-muted text-xs">
					{note}
				</div>
			) : null}
		</div>
	);
}

/** While the request is in flight; Cancel aborts it through `onCancel`. */
export function ResponseSending({ onCancel }: { onCancel?: () => void }) {
	const t = useT();
	return (
		<div data-id="response-loading" className={CENTERED}>
			<IconLoader2
				size={28}
				aria-hidden="true"
				className="text-primary motion-safe:animate-spin"
			/>
			<output data-id="response-loading-text" className="font-mono text-sm">
				{t("apiClientTools.response.sending")}
			</output>
			{onCancel ? (
				<Button size="sm" data-id="response-cancel" onClick={onCancel}>
					{t("apiClientTools.response.cancel")}
				</Button>
			) : null}
		</div>
	);
}

export function ResponseCancelled() {
	const t = useT();
	return (
		<div data-id="response-cancelled" className={CENTERED}>
			<output className="text-muted text-sm">
				{t("apiClientTools.response.cancelled")}
			</output>
		</div>
	);
}
