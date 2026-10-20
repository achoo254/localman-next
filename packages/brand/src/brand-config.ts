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
