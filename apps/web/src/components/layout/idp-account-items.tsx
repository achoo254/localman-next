import {
	IconExternalLink,
	IconKey,
	IconMail,
	IconPlug,
	IconUser,
} from "@tabler/icons-react";
import { idpAccountUrl } from "../../lib/app-config";
import { openExternal } from "../../platform/navigation";
import { DropdownMenuItem, DropdownMenuLabel } from "../ui/dropdown-menu";

/**
 * Account pages of the IdP. Email and recovery codes are IdP claims that
 * Localman only syncs at sign-in, so the menu links to them instead of
 * editing them here. The IdP has no email change flow yet; the email entry
 * opens the section that shows it.
 */
const IDP_ENTRIES = [
	{ id: "email", label: "Email", hash: "account-email", Icon: IconMail },
	{
		id: "recovery",
		label: "Mã khôi phục",
		hash: "account-recovery",
		Icon: IconKey,
	},
	{
		id: "idp",
		label: "Mật khẩu và đăng nhập",
		hash: "account-password",
		Icon: IconUser,
	},
] as const;

/**
 * Apps the user authorised (MCP clients), listed and revoked at the IdP.
 * Shown once Mock MCP is released: no app asks for Localman access before.
 */
const IDP_APPS_ENTRY = {
	id: "apps",
	label: "Ứng dụng đã cấp quyền",
	hash: "account-apps",
	Icon: IconPlug,
} as const;

export interface IdpAccountItemsProps {
	/** Adds the authorised apps entry (Mock MCP released). */
	withApps: boolean;
}

/** The account menu's links to the IdP account pages, each in a new tab. */
export function IdpAccountItems({ withApps }: IdpAccountItemsProps) {
	const entries = withApps ? [...IDP_ENTRIES, IDP_APPS_ENTRY] : IDP_ENTRIES;
	return (
		<>
			<DropdownMenuLabel>Tài khoản hoandat · mở tab mới</DropdownMenuLabel>
			{entries.map(({ id, label, hash, Icon }) => (
				<DropdownMenuItem
					key={id}
					data-id={`account-menu-${id}`}
					icon={<Icon size={16} aria-hidden={true} />}
					onSelect={() => openExternal(`${idpAccountUrl}#${hash}`)}
				>
					{label}
					<span className="sr-only">
						, mở trang tài khoản hoandat ở tab mới
					</span>
					<IconExternalLink size={14} aria-hidden="true" className="ml-auto" />
				</DropdownMenuItem>
			))}
		</>
	);
}
