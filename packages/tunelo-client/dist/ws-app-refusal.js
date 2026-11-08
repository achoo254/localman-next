import { DEFAULTS } from "./shared/constants.js";
import { stripHopByHopHeaders } from "./shared/http-headers.js";
/** A refusal for a local WS that never answered (502) or answered too late (504). */
export function unreachableRefusal(id, timedOut) {
    return {
        type: "ws-open-result",
        id,
        ok: false,
        status: timedOut ? 504 : 502,
    };
}
/**
 * Turn the app's non-101 answer to the handshake into a `ws-open-result`.
 *
 * Returns the refusal at once (status and headers) so a deadline that hits
 * while the body is still arriving can send what it has; `onDone` fires when
 * the body ended, failed, or reached `WS_APP_REJECT_BODY_MAX` bytes. The
 * server re-checks every field: this is the client's best effort, not a
 * guarantee.
 */
export function readRefusal(id, res, onDone) {
    const max = DEFAULTS.WS_APP_REJECT_BODY_MAX;
    const chunks = [];
    let size = 0;
    const refusal = {
        type: "ws-open-result",
        id,
        ok: false,
        status: res.statusCode ?? 502,
        ...(res.statusMessage ? { statusText: res.statusMessage } : {}),
        headers: stripHopByHopHeaders(res.headers),
    };
    const finish = () => onDone(refusal);
    res.on("data", (chunk) => {
        if (size >= max)
            return;
        const part = chunk.subarray(0, max - size);
        chunks.push(part);
        size += part.length;
        // Kept current, so a deadline mid-body still sends what arrived.
        refusal.body = Buffer.concat(chunks).toString("base64");
        if (size >= max)
            finish();
    });
    res.on("end", finish);
    res.on("error", finish);
    return refusal;
}
