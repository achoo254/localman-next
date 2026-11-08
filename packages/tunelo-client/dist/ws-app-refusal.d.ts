import type http from "node:http";
import type { WsOpenResultMessage } from "./shared/protocol.js";
export type WsOpenRefusal = Extract<WsOpenResultMessage, {
    ok: false;
}>;
/** A refusal for a local WS that never answered (502) or answered too late (504). */
export declare function unreachableRefusal(id: string, timedOut: boolean): WsOpenRefusal;
/**
 * Turn the app's non-101 answer to the handshake into a `ws-open-result`.
 *
 * Returns the refusal at once (status and headers) so a deadline that hits
 * while the body is still arriving can send what it has; `onDone` fires when
 * the body ended, failed, or reached `WS_APP_REJECT_BODY_MAX` bytes. The
 * server re-checks every field: this is the client's best effort, not a
 * guarantee.
 */
export declare function readRefusal(id: string, res: http.IncomingMessage, onDone: (refusal: WsOpenRefusal) => void): WsOpenRefusal;
