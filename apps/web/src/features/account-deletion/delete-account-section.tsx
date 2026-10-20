import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { LEGAL_PATHS } from "../../lib/legal";
import { useTenantInfo } from "../../lib/tenant-info";
import { DeleteAccountModal } from "./delete-account-modal";

/** Bottom of `/account`: deleting the Localman account (not the IdP's). */
export function DeleteAccountSection({ username }: { username: string }) {
	const t = useT();
	const tenant = useTenantInfo();
	const [open, setOpen] = useState(false);
	return (
		<section
			data-id="account-delete"
			aria-labelledby="account-delete-title"
			className={cn(cardClassName, "grid gap-3 px-5 py-4")}
		>
			<h2
				id="account-delete-title"
				className="m-0 font-bold font-mono text-base"
			>
				{t("account.delete.title")}
			</h2>
			<p className="m-0 text-muted text-sm">
				{t("account.delete.body", { idpName: tenant.displayName })}{" "}
				<Link
					to={LEGAL_PATHS.accountDelete}
					data-id="account-delete-learn-more"
					className="font-semibold text-primary underline underline-offset-4"
				>
					{t("account.delete.learnMore")}
				</Link>
			</p>
			<Button
				variant="danger"
				className="justify-self-start"
				onClick={() => setOpen(true)}
				data-id="account-delete-open"
			>
				{t("account.delete.open")}
			</Button>
			<DeleteAccountModal
				open={open}
				onOpenChange={setOpen}
				username={username}
			/>
		</section>
	);
}
