/** brand.config.json, as described by brand.config.schema.json. */
export interface BrandConfig {
	readonly appName: string;
	readonly shortName: string;
	readonly description: string;
	readonly colors: {
		readonly primary: string;
		readonly background: string;
		readonly backgroundDark: string;
	};
	readonly icon: string;
	readonly iconMaskable: string;
	/**
	 * Whether the web app links, serves and emits the manifest and icons
	 * (apps/web/src/config/brand-install-assets.ts). Off until the icon is
	 * designed; not in chat-next, which always ships them.
	 */
	readonly webInstall: boolean;
	readonly appIds: {
		readonly ios: string;
		readonly android: string;
		readonly desktop: string;
	};
	readonly urlScheme: string;
	readonly primaryTenant: {
		readonly domain: string;
		readonly issuer: string;
	};
	readonly hostTemplates: {
		readonly web: string;
	};
}
