import { LegalLinks } from "../../components/layout/legal-links";
import { cardClassName } from "../../components/ui/card";
import { useI18n } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import { LEGAL_EFFECTIVE_DATE, isPrimaryService } from "../../lib/legal";
import { useTenantInfo } from "../../lib/tenant-info";
import { useAppTitle } from "../../lib/use-document-title";
import { LegalPendingNotice, type PendingItem } from "./legal-pending";
import {
	type LegalKey,
	TEXT_LINK,
	legalParamsOf,
	legalText,
	renderLegalBody,
	useLegalTags,
} from "./legal-text";

export type LegalDoc = "privacy" | "terms";

type Section = readonly [id: string, title: LegalKey, body: LegalKey];

const PRIVACY_SECTIONS: readonly Section[] = [
	["data", "legalPrivacy.collect.title", "legalPrivacy.collect.body"],
	["purposes", "legalPrivacy.purposes.title", "legalPrivacy.purposes.body"],
	[
		"processors",
		"legalPrivacy.processors.title",
		"legalPrivacy.processors.body",
	],
	["location", "legalPrivacy.location.title", "legalPrivacy.location.body"],
	["retention", "legalPrivacy.retention.title", "legalPrivacy.retention.body"],
	["choices", "legalPrivacy.rights.title", "legalPrivacy.rights.body"],
	["security", "legalPrivacy.security.title", "legalPrivacy.security.body"],
	["changes", "legalPrivacy.changes.title", "legalPrivacy.changes.body"],
];

const TERMS_SECTIONS: readonly Section[] = [
	["account", "legalTerms.account.title", "legalTerms.account.body"],
	["limits", "legalTerms.limits.title", "legalTerms.limits.body"],
	["content", "legalTerms.content.title", "legalTerms.content.body"],
	["sharing", "legalTerms.sharing.title", "legalTerms.sharing.body"],
	["fair-use", "legalTerms.use.title", "legalTerms.use.body"],
	["cleanup", "legalTerms.cleanup.title", "legalTerms.cleanup.body"],
	["service", "legalTerms.service.title", "legalTerms.service.body"],
	["ending", "legalTerms.end.title", "legalTerms.end.body"],
	["changes", "legalTerms.changes.title", "legalTerms.changes.body"],
];

const DOCS = {
	privacy: {
		title: "legalPrivacy.title",
		intro: "legalPrivacy.intro",
		sections: PRIVACY_SECTIONS,
		pending: ["operator", "minimumAge", "logRetention"],
	},
	terms: {
		title: "legalTerms.title",
		intro: "legalTerms.intro",
		sections: TERMS_SECTIONS,
		pending: ["operator", "minimumAge", "liability", "governingLaw"],
	},
} as const satisfies Record<
	LegalDoc,
	{
		title: LegalKey;
		intro: LegalKey;
		sections: readonly Section[];
		pending: readonly PendingItem[];
	}
>;

/**
 * `/privacy` and `/terms`: public, no sign-in, in the language on screen.
 * The hosts and account name follow the domain the visitor is on; the
 * server location is stated only for the hoandat.com service, where it
 * is known.
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
	const { t, formatDate } = useI18n();
	const params = legalParamsOf(useTenantInfo());
	const tags = useLegalTags();
	const text = (key: LegalKey) => legalText(t, key, params);
	const page = DOCS[doc];
	const sections = page.sections.filter(
		([id]) => id !== "location" || isPrimaryService(params.appHost),
	);
	useAppTitle(text(page.title));
	return (
		<article data-id={`legal-${doc}`} className="mx-auto grid max-w-3xl gap-4">
			<header className="grid gap-1">
				<h1 className="m-0 font-bold font-mono text-xl">{text(page.title)}</h1>
				<p className="m-0 text-muted text-sm">
					{t("legal.effective", { date: formatDate(LEGAL_EFFECTIVE_DATE) })}
				</p>
			</header>
			<div
				className={cn(
					cardClassName,
					"grid gap-6 px-5 py-6 text-[0.9375rem] text-fg leading-relaxed sm:px-8",
				)}
			>
				<p className="m-0">{renderRich(text(page.intro), tags)}</p>
				<LegalPendingNotice
					items={page.pending}
					data-id={`legal-${doc}-pending`}
				/>
				{sections.map(([id, title, body]) => (
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
					</section>
				))}
				<section
					id="contact"
					aria-labelledby="contact-title"
					className="grid gap-2"
				>
					<h2 id="contact-title" className="m-0 font-bold font-mono text-base">
						{t("legal.contact.title")}
					</h2>
					<p className="m-0">{renderRich(text("legal.contact.body"), tags)}</p>
				</section>
			</div>
			<LegalLinks data-id={`legal-${doc}-links`} linkClassName={TEXT_LINK} />
		</article>
	);
}

/** Route elements (one export per page, as `lazyPage` loads them). */
export function PrivacyPage() {
	return <LegalPage doc="privacy" />;
}

export function TermsPage() {
	return <LegalPage doc="terms" />;
}
