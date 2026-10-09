import { useT } from "../../../i18n/i18n-context";

/**
 * HTML of a response, rendered in a fully sandboxed frame: `sandbox=""`
 * turns off scripts, forms, popups and same-origin access, so the page
 * cannot touch Localman's cookies or DOM. Links inside do nothing.
 */
export function HtmlPreview({ html }: { html: string }) {
	const t = useT();
	return (
		<iframe
			data-id="response-body-preview"
			title={t("apiClientTools.response.body.previewHtml")}
			sandbox=""
			referrerPolicy="no-referrer"
			srcDoc={html}
			className="min-h-80 w-full flex-1 border-0 bg-surface"
		/>
	);
}
