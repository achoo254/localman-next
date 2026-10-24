/**
 * Environments and global variables as the API returns them, shared by
 * the API, the web app and MCP. A variable's definition (name, type,
 * enabled, description) and its **shared** value are the same for everyone
 * who can see it; each person also keeps **local** values of their own,
 * never synced. Sends and scripts use the local value when there is one,
 * the shared one otherwise.
 */
import type { ElementRole } from "../../access-permissions.js";

export const ENVIRONMENT_NAME_MAX = 200;
/** As many as a collection holds (`COLLECTION_VARIABLES_MAX`). */
export const ENVIRONMENT_VARIABLES_MAX = 200;
export const VARIABLE_KEY_MAX = 200;
/** As long as a collection variable's value. */
export const VARIABLE_VALUE_MAX = 10_000;
export const VARIABLE_DESCRIPTION_MAX = 1_000;
/** Local values one person keeps per scope (what a script may set). */
export const LOCAL_VALUES_MAX = 500;
/** Environments one workspace may hold, so its list is one bounded query. */
export const ENVIRONMENTS_PER_WORKSPACE_MAX = 200;

/** Named after the `--c-viz-*` tokens they show with. */
export const ENVIRONMENT_COLORS = [
	"grey",
	"green",
	"blue",
	"cyan",
	"amber",
	"violet",
	"red",
] as const;
export type EnvironmentColor = (typeof ENVIRONMENT_COLORS)[number];

/** `secret`: masked in the UI and encrypted at rest. */
export const VARIABLE_TYPES = ["default", "secret"] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];

/** Where a variable lives; later kinds override earlier ones. */
export const VARIABLE_SCOPE_KINDS = [
	"global",
	"collection",
	"environment",
	"temporary",
] as const;
export type VariableScopeKind = (typeof VARIABLE_SCOPE_KINDS)[number];

/** A variable of an environment or of the globals. */
export interface SharedVariable {
	/** Stable across renames; local values follow the name, not this id. */
	id: string;
	key: string;
	type: VariableType;
	/** A disabled variable resolves to nothing, wherever it is used. */
	enabled: boolean;
	description: string;
	/** `null` when the value is not shared (each person sets their own). */
	sharedValue: string | null;
}

export interface VariableView extends SharedVariable {
	/**
	 * A secret's shared value exists but is withheld from the caller (a
	 * Viewer, or anyone while the server cannot decrypt it): `sharedValue`
	 * is `null`, and a send using it stops until the caller sets a local
	 * value.
	 */
	sharedHidden: boolean;
}

/** One local value of the caller, by variable name. */
export interface LocalValue {
	key: string;
	/** For a secret, a vault ciphertext (`lmv1:`) once the vault is on. */
	value: string;
	/** The user let agents use this vault value (ADR-0009). */
	agentUse?: boolean;
	/**
	 * Set by the web, never sent: a vault value it cannot decrypt now (the
	 * vault is locked). It counts as withheld, so a send using it stops.
	 */
	locked?: boolean;
}

export interface EnvironmentSummary {
	id: string;
	workspaceId: string;
	name: string;
	color: EnvironmentColor;
	/** The caller's role: Editors change it, Viewers set local values only. */
	role: ElementRole;
	variableCount: number;
	updatedAt: string;
}

export interface EnvironmentDetail extends EnvironmentSummary {
	variables: VariableView[];
	localValues: LocalValue[];
	createdBy: string;
	/** Name (else username) of the creator; `null` once the account is gone. */
	createdByName: string | null;
	createdAt: string;
}

/** The global variables of a workspace, always in use, lowest precedence. */
export interface GlobalsDetail {
	workspaceId: string;
	/** Admins and Editors of the workspace edit; Viewers set local values. */
	role: ElementRole;
	variables: VariableView[];
	localValues: LocalValue[];
	/** `null` while nobody has saved any global. */
	updatedAt: string | null;
}

/** The environment the caller uses in a workspace (one per person). */
export interface ActiveEnvironment {
	workspaceId: string;
	environmentId: string | null;
}
