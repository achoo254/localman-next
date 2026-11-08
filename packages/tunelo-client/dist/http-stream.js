import http from "node:http";
import { DEFAULTS } from "./shared/constants.js";
import { stripHopByHopHeaders } from "./shared/http-headers.js";
/** Cap on body bytes captured for the inspector — streams are not fully buffered. */
const INSPECTOR_PREVIEW_CAP = 256 * 1024;
/** Coalesce chunks into frames of about this size to bound frames/sec. */
const FRAME_BYTES = 256 * 1024;
/** Pause the local read when the transport queue grows past this (backpressure). */
const HIGH_WATER = 4 * 1024 * 1024;
const LOW_WATER = 1 * 1024 * 1024;
/**
 * Relay one request to the local service and stream the response back as
 * stream-start → stream-data* → stream-end. Chunks are coalesced by size,
 * the local read is paused when the transport queue is full, and exactly one
 * terminal path (end / error / cancel) ever runs.
 */
export function proxyRequestStream(request, localPort, transport, localHost = "localhost") {
    const id = request.id;
    let settled = false;
    let started = false;
    let resStream = null;
    let resolveDone;
    const done = new Promise((r) => {
        resolveDone = r;
    });
    const previewChunks = [];
    let previewSize = 0;
    let truncated = false;
    let status = 502;
    let headers = {};
    function capturePreview(chunk) {
        if (truncated)
            return;
        const remaining = INSPECTOR_PREVIEW_CAP - previewSize;
        if (remaining <= 0) {
            truncated = true;
            return;
        }
        const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
        previewChunks.push(slice);
        previewSize += slice.length;
        if (chunk.length > remaining)
            truncated = true;
    }
    function finish() {
        if (settled)
            return;
        settled = true;
        resolveDone({
            status,
            headers,
            bodyPreview: previewChunks.length
                ? Buffer.concat(previewChunks).toString("base64")
                : null,
            truncated,
        });
    }
    function fail(message) {
        if (settled)
            return;
        if (started) {
            transport.send({ type: "stream-error", id, message });
        }
        else {
            status = 502;
            headers = { "content-type": "text/plain" };
            const payload = Buffer.from(message);
            capturePreview(payload);
            transport.send({ type: "stream-start", id, status, headers });
            transport.send({
                type: "stream-data",
                id,
                data: payload.toString("base64"),
            });
            transport.send({ type: "stream-end", id });
        }
        finish();
    }
    let pending = [];
    let pendingBytes = 0;
    let flushScheduled = false;
    function flushNow() {
        if (pending.length === 0 || settled)
            return;
        const buf = Buffer.concat(pending);
        pending = [];
        pendingBytes = 0;
        transport.send({ type: "stream-data", id, data: buf.toString("base64") });
        applyBackpressure();
    }
    function scheduleFlush() {
        if (flushScheduled)
            return;
        flushScheduled = true;
        setImmediate(() => {
            flushScheduled = false;
            flushNow();
        });
    }
    function applyBackpressure() {
        if (!resStream || resStream.isPaused())
            return;
        if (transport.bufferedAmount() <= HIGH_WATER)
            return;
        resStream.pause();
        const timer = setInterval(() => {
            if (settled) {
                clearInterval(timer);
                return;
            }
            if (transport.bufferedAmount() <= LOW_WATER) {
                clearInterval(timer);
                resStream?.resume();
            }
        }, 25);
    }
    const body = request.body ? Buffer.from(request.body, "base64") : null;
    const proxyReq = http.request({
        hostname: localHost,
        port: localPort,
        path: request.path,
        method: request.method,
        headers: stripHopByHopHeaders(request.headers),
    }, (proxyRes) => {
        if (settled)
            return;
        resStream = proxyRes;
        status = proxyRes.statusCode ?? 502;
        // Strip hop-by-hop headers — the tunnel server applies its own framing.
        headers = stripHopByHopHeaders(proxyRes.headers);
        started = true;
        transport.send({ type: "stream-start", id, status, headers });
        proxyRes.on("data", (chunk) => {
            if (settled)
                return;
            capturePreview(chunk);
            pending.push(chunk);
            pendingBytes += chunk.length;
            if (pendingBytes >= FRAME_BYTES)
                flushNow();
            else
                scheduleFlush();
        });
        proxyRes.on("end", () => {
            if (settled)
                return;
            flushNow();
            transport.send({ type: "stream-end", id });
            finish();
        });
        proxyRes.on("error", () => fail("Local response error"));
        proxyRes.on("aborted", () => fail("Local response aborted"));
    });
    proxyReq.on("error", (err) => {
        const code = err.code;
        fail(code === "ECONNREFUSED" ? "Local service unavailable" : err.message);
    });
    proxyReq.setTimeout(DEFAULTS.STREAM_IDLE_TIMEOUT_MS, () => {
        fail("Local service timeout");
        proxyReq.destroy();
    });
    if (body)
        proxyReq.write(body);
    proxyReq.end();
    return {
        cancel() {
            if (settled)
                return;
            settled = true;
            proxyReq.destroy();
            resolveDone({
                status,
                headers,
                bodyPreview: previewChunks.length
                    ? Buffer.concat(previewChunks).toString("base64")
                    : null,
                truncated,
            });
        },
        done,
    };
}
