export interface TunnelMapping {
    port: number;
    subdomain?: string;
}
/** Parse "port:subdomain" or "port" syntax into TunnelMapping */
export declare function parseTunnelArg(arg: string): TunnelMapping;
/** Parse multiple tunnel args into TunnelMapping array */
export declare function parseTunnelArgs(args: string[]): TunnelMapping[];
