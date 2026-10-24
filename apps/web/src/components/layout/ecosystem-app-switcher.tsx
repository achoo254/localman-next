import "@shared-next/app-switcher/app-switcher.css";
import { brand } from "@localman/shared/brand";
import { AppSwitcher } from "@shared-next/app-switcher";
import { useI18n } from "../../i18n/i18n-context";
import { useTenantInfo } from "../../lib/tenant-info";
import { isNativeBuild } from "../../platform/native/native-build";
import { openExternal } from "../../platform/navigation";

/** Host label of the IdP on every tenant domain (`auth.<domain>`). */
const IDP_HOST_PREFIX = "auth.";

/**
 * Root domain of the tenant (`hoandat.com`) from its IdP origin
 * (`https://auth.hoandat.com`), or null when the IdP is not on
 * `auth.<domain>` (a local IdP in development): no switcher then.
 */
export function tenantDomainOfIdp(idpOrigin: string): string | null {
	let host: string;
	try {
		host = new URL(idpOrigin).host;
	} catch {
		return null;
	}
	if (!host.startsWith(IDP_HOST_PREFIX)) return null;
	const domain = host.slice(IDP_HOST_PREFIX.length);
	return domain === "" ? null : domain;
}

function openInSystemBrowser(url: string): void {
	openExternal(url);
}

/**
 * The 9-dot button listing the other apps the same account signs in to
 * (`@shared-next/app-switcher`). Signed-in top bar only.
 */
export function EcosystemAppSwitcher() {
	const { locale } = useI18n();
	const tenantDomain = tenantDomainOfIdp(useTenantInfo().idpOrigin);
	if (tenantDomain === null) return null;
	return (
		<AppSwitcher
			current="localman"
			tenantDomain={tenantDomain}
			// Scribe runs on the primary tenant (hoandat.com) only: a self-hosted
			// install on another domain lists the other apps without it.
			isPrimaryTenant={tenantDomain === brand.primaryTenant.domain}
			locale={locale}
			// The shell's WebView must not load another app: system browser.
			onOpen={isNativeBuild ? openInSystemBrowser : undefined}
			className="app-header-switcher"
		/>
	);
}
