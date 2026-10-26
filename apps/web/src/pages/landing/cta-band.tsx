import { cardClassName } from "../../components/ui/card";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { CtaPerks } from "./cta-perks";
import { StartCta } from "./start-cta";

/**
 * Call to action right after the interactive demos, where a visitor who
 * just played with the tree is most ready to try it on their own API.
 * A light card so it does not compete with the closing band.
 */
export function MidCta() {
	const t = useT();
	return (
		<section
			data-id="landing-mid-cta"
			aria-labelledby="landing-mid-cta-title"
			className={cn(
				cardClassName,
				"flex flex-wrap items-center justify-between gap-6 p-6",
			)}
		>
			<div className="grid gap-2">
				<h2
					id="landing-mid-cta-title"
					className="m-0 font-bold text-xl tracking-[-0.01em]"
				>
					{t("landing.midCta.title")}
				</h2>
				<CtaPerks data-id="landing-mid-cta-perks" />
			</div>
			<StartCta data-id="landing-mid-cta-button" />
		</section>
	);
}

/**
 * Closing call to action: the only block on solid primary, so it reads as
 * the end of the page and the button in the surface colour stands out.
 */
export function CtaBand() {
	const t = useT();
	return (
		<section
			data-id="landing-cta"
			aria-labelledby="landing-cta-title"
			className="my-16 flex flex-wrap items-center justify-between gap-6 rounded-xl bg-primary-solid p-8 text-on-primary shadow-glow-primary md:p-12"
		>
			<div className="grid max-w-160 gap-3">
				<h2
					id="landing-cta-title"
					className="m-0 font-bold text-[clamp(1.5rem,3.4vw,2.125rem)] leading-tight tracking-[-0.02em]"
				>
					{t("landing.cta.title")}
				</h2>
				<p className="m-0 text-[1.0625rem]">{t("landing.cta.text")}</p>
				<CtaPerks data-id="landing-cta-perks" inverse />
			</div>
			<StartCta data-id="landing-cta-button" inverse />
		</section>
	);
}
