import {
	IconExternalLink,
	IconMail,
	IconPlug,
	IconUser,
} from "@tabler/icons-react";
import { useT } from "../../i18n/i18n-context";
import { idpAccountUrlOf, useTenantInfo } from "../../lib/tenant-info";
import { openExternal } from "../../platform/navigation";
import { DropdownMenuItem, DropdownMenuLabel } from "../ui/dropdown-menu";

/**
 * Account pages of the IdP. Email and the linked sign-in methods (Google,
 * GitHub) are IdP data that Localman only syncs at sign-in, so the menu
 * links to them instead of editing them here. The IdP has no email change flow yet; the email entry
 * opens the section that shows it.
 */
const IDP_ENTRIES = [
	{ id: "email", labelKey: "email", hash: "account-email", Icon: IconMail },
	{
		id: "idp",
		labelKey: "signIn",
		hash: "account-sign-in",
		Icon: IconUser,
	},
] as const;

/**
 * Apps the user authorised (MCP clients), listed and revoked at the IdP.
 * Shown once Mock MCP is released: no app asks for Localman access before.
 */
const IDP_APPS_ENTRY = {
	id: "apps",
	labelKey: "apps",
	hash: "account-apps",
	Icon: IconPlug,
} as const;

export interface IdpAccountItemsProps {
	/** Adds the authorised apps entry (Mock MCP released). */
	withApps: boolean;
}

/** The account menu's links to the IdP account pages, each in a new tab. */
export function IdpAccountItems({ withApps }: IdpAccountItemsProps) {
	const t = useT();
	const tenant = useTenantInfo();
	const idpName = tenant.displayName;
	const entries = withApps ? [...IDP_ENTRIES, IDP_APPS_ENTRY] : IDP_ENTRIES;
	return (
		<>
			<DropdownMenuLabel>
				{t("layout.idpMenu.heading", { idpName })}
			</DropdownMenuLabel>
			{entries.map(({ id, labelKey, hash, Icon }) => (
				<DropdownMenuItem
					key={id}
					data-id={`account-menu-${id}`}
					icon={<Icon size={16} aria-hidden={true} />}
					onSelect={() => openExternal(`${idpAccountUrlOf(tenant)}#${hash}`)}
				>
					{t(`layout.idpMenu.${labelKey}`)}
					<span className="sr-only">
						{t("layout.idpMenu.opensIdp", { idpName })}
					</span>
					<IconExternalLink size={14} aria-hidden="true" className="ml-auto" />
				</DropdownMenuItem>
			))}
		</>
	);
}
