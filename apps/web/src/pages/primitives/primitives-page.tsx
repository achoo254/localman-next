import { Wordmark } from "../../components/brand/wordmark";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { ButtonShowcase } from "./button-showcase";
import { FeedbackShowcase } from "./feedback-showcase";
import { FormShowcase } from "./form-showcase";
import { OverlayShowcase } from "./overlay-showcase";

/** Reference page for comparing the UI primitives with the prototype. */
export function PrimitivesPage() {
	const t = useT();
	return (
		<article data-id="primitives" className="grid gap-6">
			<header className="grid gap-2">
				<p className="m-0 font-mono font-semibold text-primary text-xs uppercase tracking-[0.12em]">
					{t("primitives.eyebrow")}
				</p>
				<h1 className="m-0 font-bold text-3xl tracking-[-0.02em]">
					{renderRich(t("primitives.title"), {
						brand: () => <Wordmark className="text-3xl" />,
					})}
				</h1>
				<p className="m-0 max-w-160 text-muted">{t("primitives.lead")}</p>
			</header>
			<ButtonShowcase />
			<FormShowcase />
			<FeedbackShowcase />
			<OverlayShowcase />
		</article>
	);
}
