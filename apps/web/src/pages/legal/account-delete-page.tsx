import { Link, useSearchParams } from "react-router";
import { LegalLinks } from "../../components/layout/legal-links";
import { Alert } from "../../components/ui/alert";
import { buttonClassName } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { ACCOUNT_DELETED_QUERY } from "../../lib/legal";
import { useTenantInfo } from "../../lib/tenant-info";
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
	[
		"blocked",
		"legal.accountDelete.blockedTitle",
		"legal.accountDelete.blocked",
	],
	["kept", "legal.accountDelete.keptTitle", "legal.accountDelete.kept"],
	["idp", "legal.accountDelete.idpTitle", "legal.accountDelete.idp"],
	[
		"no-access",
		"legal.accountDelete.noAccessTitle",
		"legal.accountDelete.noAccess",
	],
];

/**
 * `/account/delete`: public page on how to delete a Localman account and
 * what happens, at a stable address the app stores can link to. The
 * deletion itself happens on `/account` once signed in.
 */
export function AccountDeletePage() {
	const t = useT();
	const params = legalParamsOf(useTenantInfo());
	const tags = useLegalTags();
	const text = (key: LegalKey) => legalText(t, key, params);
	const [search] = useSearchParams();
	useAppTitle(t("legal.accountDelete.title"));
	return (
		<article
			data-id="legal-account-delete"
			className="mx-auto grid max-w-3xl gap-4"
		>
			<h1 className="m-0 font-bold font-mono text-xl">
				{t("legal.accountDelete.title")}
			</h1>
			{search.has(ACCOUNT_DELETED_QUERY) ? (
				<Alert tone="success" data-id="legal-account-deleted">
					{t("legal.accountDelete.deleted")}
				</Alert>
			) : null}
			<div
				className={cn(
					cardClassName,
					"grid gap-6 px-5 py-6 text-[0.9375rem] text-fg leading-relaxed sm:px-8",
				)}
			>
				<p className="m-0">{t("legal.accountDelete.intro")}</p>
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
							<Link
								to="/account"
								data-id="legal-account-delete-open"
								className={cn(
									buttonClassName(),
									"justify-self-start no-underline",
								)}
							>
								{t("legal.accountDelete.openAccount")}
							</Link>
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
