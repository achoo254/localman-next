/** WS message types for tunnel protocol — discriminated union on "type" field */
/** Parse raw WS text message into typed protocol message */
export function parseMessage(data) {
    return JSON.parse(data);
}
/** WS close codes for clean disconnect reasons */
export const WS_CLOSE_CODES = {
    NORMAL: 1000,
    GOING_AWAY: 1001,
    AUTH_FAILED: 4001,
    AUTH_TIMEOUT: 4002,
    RATE_LIMITED: 4003,
    SUBDOMAIN_TAKEN: 4004,
};
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["AUTH_FAILED"] = "AUTH_FAILED";
    ErrorCode["SUBDOMAIN_TAKEN"] = "SUBDOMAIN_TAKEN";
    ErrorCode["SUBDOMAIN_INVALID"] = "SUBDOMAIN_INVALID";
    ErrorCode["REQUEST_TIMEOUT"] = "REQUEST_TIMEOUT";
    ErrorCode["TUNNEL_NOT_FOUND"] = "TUNNEL_NOT_FOUND";
    ErrorCode["BODY_TOO_LARGE"] = "BODY_TOO_LARGE";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["INVALID_CREDENTIALS"] = "INVALID_CREDENTIALS";
    ErrorCode["TOTP_REQUIRED"] = "TOTP_REQUIRED";
    ErrorCode["TOTP_INVALID"] = "TOTP_INVALID";
    ErrorCode["MAX_KEYS_REACHED"] = "MAX_KEYS_REACHED";
    ErrorCode["KEY_NOT_FOUND"] = "KEY_NOT_FOUND";
    ErrorCode["EMAIL_TAKEN"] = "EMAIL_TAKEN";
    ErrorCode["ADMIN_FORBIDDEN"] = "ADMIN_FORBIDDEN";
    ErrorCode["MAX_TUNNELS_EXCEEDED"] = "MAX_TUNNELS_EXCEEDED";
})(ErrorCode || (ErrorCode = {}));
