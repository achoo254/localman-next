import "@achoo254/app-switcher/app-switcher.css";
import { AppSwitcher } from "@achoo254/app-switcher";
import { DOMAIN_PATTERN } from "@shared-next/brand/hosts";
import { useI18n } from "../../i18n/i18n-context";
import { useLoadedTenantInfo } from "../../lib/tenant-info";
import { isNativeBuild } from "../../platform/native/native-build";
import { openExternal } from "../../platform/navigation";

/** Host label of the IdP on every tenant domain (`auth.<domain>`). */
const IDP_HOST_PREFIX = "auth.";

/**
 * Root domain of the tenant (`hoandat.com`) from its IdP origin
 * (`https://auth.hoandat.com`), or null when there is no switcher to show:
 * the origin is not a URL, has a port, or its host is not `auth.<domain>`
 * with `<domain>` a lowercase registrable domain (the brand package's
 * DOMAIN_PATTERN, which the switcher's links require; a trailing dot fails
 * it too). A local IdP in development gives null.
 */
export function tenantDomainOfIdp(idpOrigin: string): string | null {
	let url: URL;
	try {
		url = new URL(idpOrigin);
	} catch {
		return null;
	}
	if (url.port !== "" || !url.hostname.startsWith(IDP_HOST_PREFIX)) {
		return null;
	}
	const domain = url.hostname.slice(IDP_HOST_PREFIX.length);
	return DOMAIN_PATTERN.test(domain) ? domain : null;
}

function openInSystemBrowser(url: string): void {
	openExternal(url);
}

/**
 * The 9-dot button listing the other apps the same account signs in to
 * (`@achoo254/app-switcher`). Signed-in top bar only. It waits for the
 * domain the page is on (`/api/v1/tenant`): the primary domain's defaults
 * would link another tenant's people to hoandat.com. Until then an empty
 * box of the button's size keeps the top bar from shifting.
 */
export function EcosystemAppSwitcher() {
	const { locale } = useI18n();
	const tenant = useLoadedTenantInfo();
	if (tenant === null) {
		return (
			<span
				aria-hidden="true"
				data-id="topbar-app-switcher-placeholder"
				className="size-9 flex-none pointer-coarse:size-11"
			/>
		);
	}
	const tenantDomain = tenantDomainOfIdp(tenant.idpOrigin);
	if (tenantDomain === null) return null;
	return (
		<AppSwitcher
			current="localman"
			domain={tenantDomain}
			locale={locale}
			// The shell's WebView must not load another app: system browser.
			onOpen={isNativeBuild ? openInSystemBrowser : undefined}
			className="app-header-switcher"
		/>
	);
}
