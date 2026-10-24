import { z } from "zod";

const MIB = 1024 * 1024;
/**
 * 200 variables at their longest (name, value, description), at 3 bytes
 * a character (Vietnamese, CJK), plus room for the JSON: about 7 MB.
 */
export const VARIABLES_BODY_LIMIT = 10 * MIB;
/**
 * 500 local values at their longest would be about 15 MB at 3 bytes a
 * character; nginx caps `/api/v1/environments|workspaces|collections/`
 * at 16m, so 15 MiB is the most a request can carry anyway.
 */
export const LOCAL_VALUES_BODY_LIMIT = 15 * MIB;
export const environmentIdSchema = z.string().min(1).max(64);
export const workspaceIdSchema = z.string().min(1).max(64);
export const ENVIRONMENT_PATH = "/environments/:environmentId";
export const VALUES_NOTE =
	"Requests and scripts use the caller's local value of a variable when they have one, its shared value otherwise. A Viewer never receives a secret's shared value (`sharedHidden: true`), and neither does anyone while the server cannot decrypt it; a request using such a value stops with SECRET_WITHHELD until the caller sets a local value. Called with an agent token (MCP) rather than a browser session, no secret value is ever returned: shared ones read as `sharedValue: null, sharedHidden: true` and local ones as `value: null, hidden: true`; an agent may still write them.";
/** Set operations of shared values (environments, globals). */
export const AGENT_KEEPS_SHARED =
	"Called with an agent token, a secret sent back as `sharedValue: null` (as an agent reads it) keeps its stored value; send a value to replace it.";
/** Set operations of local values (environments, globals, collections). */
export const AGENT_KEEPS_LOCAL =
	"Called with an agent token, `value: null` for a secret (as an agent reads it) keeps your local value instead of resetting it. When the server runs the secret vault, local values of secret variables are encrypted in the user's browser: an agent cannot write them (403 SECRET_VAULT_AGENT_WRITE), a browser writes them as `lmv1:` ciphertext (409 SECRET_VAULT_REQUIRED otherwise), and `agentUse: true` marks one the user lets agents use through send_request `variables`.";
