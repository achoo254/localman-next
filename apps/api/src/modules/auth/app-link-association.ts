import { OperationError } from "@localman/operations";
import { brand } from "@localman/shared/brand";
import type { Router } from "express";
import { AUTH_PATHS, MOBILE_PATHS } from "../../operations/protocol-routes.js";

/**
 * Signed builds of the native app that may receive the mobile sign-in
 * callback (`MOBILE_IOS_TEAM_ID`, `MOBILE_ANDROID_CERT_SHA256`). Bundle id
 * and package name come from brand.config.json.
 */
export interface MobileAppSettings {
	readonly iosTeamId?: string;
	readonly androidCertSha256: readonly string[];
}

/** The mobile sign-in is on once at least one platform is configured. */
export function mobileSignInEnabled(settings: MobileAppSettings | undefined) {
	return (
		settings !== undefined &&
		(settings.iosTeamId !== undefined || settings.androidCertSha256.length > 0)
	);
}

/**
 * `applinks`: only `/m/auth/callback` opens the app (Universal Links).
 * `webcredentials`: an `ASWebAuthenticationSession` with an https callback
 * (iOS 17.4+) completes only for an app associated with the host this way.
 */
export function appleAppSiteAssociation(teamId: string) {
	const appId = `${teamId}.${brand.appIds.ios}`;
	return {
		applinks: {
			details: [
				{
					appIDs: [appId],
					components: [{ "/": AUTH_PATHS.mobileCallback }],
				},
			],
		},
		webcredentials: { apps: [appId] },
	};
}

/** Digital Asset Links: App Links of the callback, and shared sign-in. */
export function androidAssetLinks(fingerprints: readonly string[]) {
	return [
		{
			relation: [
				"delegate_permission/common.handle_all_urls",
				"delegate_permission/common.get_login_creds",
			],
			target: {
				namespace: "android_app",
				package_name: brand.appIds.android,
				sha256_cert_fingerprints: fingerprints,
			},
		},
	];
}

/**
 * Serves both association files on every tenant host (the same apps
 * serve every tenant; the host decides which callback the app verifies).
 * A platform without configuration answers 404, so no app is associated.
 */
export function registerAppLinkAssociation(
	router: Router,
	settings: MobileAppSettings | undefined,
): void {
	router.get(MOBILE_PATHS.appleAssociation, (_req, res) => {
		const teamId = settings?.iosTeamId;
		if (teamId === undefined) {
			res.status(404).json(notFound());
			return;
		}
		// Apple's CDN refetches it; a day keeps changes reasonably quick.
		res.set("Cache-Control", "public, max-age=86400");
		res.json(appleAppSiteAssociation(teamId));
	});
	router.get(MOBILE_PATHS.androidAssetLinks, (_req, res) => {
		const fingerprints = settings?.androidCertSha256 ?? [];
		if (fingerprints.length === 0) {
			res.status(404).json(notFound());
			return;
		}
		res.set("Cache-Control", "public, max-age=86400");
		res.json(androidAssetLinks(fingerprints));
	});
}

function notFound() {
	return new OperationError(404, "NOT_FOUND", "Route not found").toBody();
}
