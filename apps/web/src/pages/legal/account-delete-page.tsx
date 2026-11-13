import { LegalLinks } from "../../components/layout/legal-links";
import { buttonClassName } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { idpAccountDeleteUrlOf, useTenantInfo } from "../../lib/tenant-info";
import { useAppTitle } from "../../lib/use-document-title";
import {
	type LegalKey,
	TEXT_LINK,
	legalParamsOf,
	legalText,
	renderLegalBody,
	useLegalTags,
} from "./legal-text";

const SECTIONS: ReadonlyArray<readonly [string, LegalKey, LegalKey]> = [
	["how", "legal.accountDelete.howTitle", "legal.accountDelete.how"],
	["what", "legal.accountDelete.whatTitle", "legal.accountDelete.what"],
	["kept", "legal.accountDelete.keptTitle", "legal.accountDelete.kept"],
	[
		"no-access",
		"legal.accountDelete.noAccessTitle",
		"legal.accountDelete.noAccess",
	],
];

/**
 * `/account/delete`: public page on how an account is deleted and what
 * happens to its Localman data, at a stable address the app stores can
 * link to. The deletion itself happens only on the IdP's account page.
 */
export function AccountDeletePage() {
	const t = useT();
	const tenant = useTenantInfo();
	const params = legalParamsOf(tenant);
	const tags = useLegalTags();
	const text = (key: LegalKey) => legalText(t, key, params);
	useAppTitle(t("legal.accountDelete.title"));
	return (
		<article
			data-id="legal-account-delete"
			className="mx-auto grid max-w-3xl gap-4"
		>
			<h1 className="m-0 font-bold font-mono text-xl">
				{t("legal.accountDelete.title")}
			</h1>
			<div
				className={cn(
					cardClassName,
					"grid gap-6 px-5 py-6 text-[0.9375rem] text-fg leading-relaxed sm:px-8",
				)}
			>
				<p className="m-0">{text("legal.accountDelete.intro")}</p>
				{SECTIONS.map(([id, title, body]) => (
					<section
						key={id}
						id={id}
						aria-labelledby={`${id}-title`}
						className="grid gap-2"
					>
						<h2
							id={`${id}-title`}
							className="m-0 font-bold font-mono text-base"
						>
							{text(title)}
						</h2>
						{renderLegalBody(text(body), tags)}
						{id === "how" ? (
							<a
								href={idpAccountDeleteUrlOf(tenant)}
								data-id="legal-account-delete-open"
								className={cn(
									buttonClassName(),
									"justify-self-start no-underline",
								)}
							>
								{text("legal.accountDelete.openAccount")}
							</a>
						) : null}
					</section>
				))}
			</div>
			<LegalLinks
				data-id="legal-account-delete-links"
				linkClassName={TEXT_LINK}
			/>
		</article>
	);
}
