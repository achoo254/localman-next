import type { ReactNode } from "react";
import { Link } from "react-router";
import { ExternalLink } from "../../components/ui/external-link";
import type { MessageKey, ParamsOf } from "../../i18n/message-types";
import { type TagRenderers, renderRich } from "../../i18n/rich-text";
import type { Translate } from "../../i18n/translate";
import { LEGAL_PATHS, PROCESSOR_POLICY_URLS } from "../../lib/legal";
import {
	type TenantInfo,
	idpAccountDeleteUrlOf,
	useTenantInfo,
} from "../../lib/tenant-info";

/** An underlined link inside running text. */
export const TEXT_LINK =
	"font-semibold text-primary underline underline-offset-4 hover:no-underline";

/** What the legal texts may name: the hosts of this domain and its account. */
export type LegalParams = Readonly<
	Record<"appHost" | "idpName" | "idpHost" | "tunnelHost", string>
>;

/** Keys whose placeholders, if any, are all `LegalParams`. */
export type LegalKey = {
	[K in MessageKey]: ParamsOf<K> extends undefined
		? K
		: keyof ParamsOf<K> extends keyof LegalParams
			? K
			: never;
}[MessageKey];

/**
 * The text of `key` with the domain's names filled in. `t` fills
 * placeholders by name and ignores the ones a text does not use, so one
 * call shape serves every `LegalKey`; the cast only widens `t`'s per-key
 * signature.
 */
export function legalText(
	t: Translate,
	key: LegalKey,
	params: LegalParams,
): string {
	const translate = t as (key: LegalKey, params: LegalParams) => string;
	return translate(key, params);
}

function hostOf(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}

/** Names of the domain the visitor is on (the defaults until it is known). */
export function legalParamsOf(tenant: TenantInfo): LegalParams {
	return {
		appHost: hostOf(tenant.publicUrl),
		idpName: tenant.displayName,
		idpHost: hostOf(tenant.idpOrigin),
		tunnelHost: tenant.tunnelDomain ?? "Tunelo",
	};
}

function external(href: string) {
	return (chunk: string) => (
		<ExternalLink href={href} className={TEXT_LINK}>
			{chunk}
		</ExternalLink>
	);
}

function internal(to: string) {
	return (chunk: string) => (
		<Link to={to} className={TEXT_LINK}>
			{chunk}
		</Link>
	);
}

/** Links the legal texts open with their tags, for this domain. */
export function useLegalTags(): TagRenderers {
	const tenant = useTenantInfo();
	return {
		cloudflare: external(PROCESSOR_POLICY_URLS.cloudflare),
		telegram: external(PROCESSOR_POLICY_URLS.telegram),
		idp: external(tenant.idpOrigin),
		idpDelete: external(idpAccountDeleteUrlOf(tenant)),
		...(tenant.tunnelDomain
			? { tunelo: external(`https://${tenant.tunnelDomain}`) }
			: {}),
		privacy: internal(LEGAL_PATHS.privacy),
		terms: internal(LEGAL_PATHS.terms),
		accountDelete: internal(LEGAL_PATHS.accountDelete),
	};
}

/**
 * A section body: paragraphs split by a blank line; a paragraph whose
 * lines all start with "- " is a list.
 */
export function renderLegalBody(text: string, tags: TagRenderers): ReactNode {
	return text.split("\n\n").map((block) => {
		const lines = block.split("\n");
		if (lines.every((line) => line.startsWith("- "))) {
			return (
				<ul key={block} className="m-0 grid list-disc gap-2 pl-5">
					{lines.map((line) => (
						<li key={line}>{renderRich(line.slice(2), tags)}</li>
					))}
				</ul>
			);
		}
		return (
			<p key={block} className="m-0">
				{renderRich(block, tags)}
			</p>
		);
	});
}
