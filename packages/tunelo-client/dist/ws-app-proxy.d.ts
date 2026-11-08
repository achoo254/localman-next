import type { WsCloseMessage, WsDataMessage, WsOpenMessage, WsOpenResultMessage } from "./shared/protocol.js";
export type WsAppSend = (msg: WsDataMessage | WsCloseMessage | WsOpenResultMessage) => void;
export interface WsAppProxyOptions {
    /** Cap on the local handshake (ms). Overridden only by tests. */
    handshakeTimeoutMs?: number;
    /** Host the local app listens on; default `localhost`. */
    localHost?: string | undefined;
}
/**
 * Client side of the WebSocket-to-app relay: opens a local WS per `ws-open`
 * and bridges frames both ways. Mirrors the server's connection model.
 *
 * Every `ws-open` gets one `ws-open-result`: a server that knows the message
 * answers the browser with it; an older server ignores it and acts on the
 * `ws-close` that follows a failure, exactly as before.
 */
export declare class WsAppProxy {
    private readonly send;
    private readonly resolvePort;
    private readonly options;
    private conns;
    constructor(send: WsAppSend, resolvePort: (subdomain: string) => number, options?: WsAppProxyOptions);
    open(msg: WsOpenMessage): void;
    data(msg: WsDataMessage): void;
    close(msg: WsCloseMessage): void;
    /** Control socket dropped — tear down all local WS connections. */
    closeAll(): void;
    /**
     * Report a local WS that never opened: the result for servers that know
     * it, then the `ws-close` older servers act on. Once per connection.
     */
    private fail;
}
