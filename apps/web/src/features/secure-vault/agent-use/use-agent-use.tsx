/**
 * "Let agents use" of one scope (environment, globals, a collection's
 * variables): the caller's list of secrets their agents may fill in, the
 * dialog that turns one on or edits its hosts, and turning it off. Shown
 * only while the `secretVault` flag is on and the server runs the vault.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { useToast } from "../../../components/ui/toast";
import { useT } from "../../../i18n/i18n-context";
import { useVaultUi } from "../../environments/use-vault-ui";
import { secretNames } from "../vault-codec";
import { agentCopyKeys, writeAgentCopy } from "./agent-copy";
import {
	type AgentSecretUse,
	type AgentUseTarget,
	agentUsesKey,
	fetchAgentUses,
	removeAgentUse,
	saveAgentUse,
} from "./agent-use-api";
import { AgentUseDialog } from "./agent-use-dialog";
import { AgentCopyError } from "./agent-use-errors";
import type { AgentUseScope, AgentUseSubject } from "./agent-use-types";
import { type OwnVariable, ownHostSources } from "./cached-host-sources";

export interface AgentUse {
	/** `null` while it does not apply (flag off, server without vault). */
	scope: AgentUseScope | null;
	/** Names whose use is on: a new local value of one carries its copy. */
	keys: ReadonlySet<string>;
	/** The dialog, to render once beside the table. */
	dialog: ReactNode;
	/** The scope's secret names: their local values go through the vault. */
	secrets: ReadonlySet<string>;
}

/**
 * `variables` and `localValues` (opened) of the scope: its secret names,
 * and its base URLs to suggest hosts from first.
 */
export function useAgentUse(
	target: AgentUseTarget | null,
	variables: readonly (OwnVariable & { type?: string; secret?: boolean })[],
	localValues: readonly { key: string; value: string; agentUse?: boolean }[],
): AgentUse {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const vault = useVaultUi();
	const running =
		vault === "none" || vault === "locked" || vault === "unlocked";
	const key = agentUsesKey(target);
	const query = useQuery({
		queryKey: key,
		queryFn: () => (target ? fetchAgentUses(target) : null),
		enabled: running && target !== null,
	});
	const [subject, setSubject] = useState<AgentUseSubject | null>(null);
	const secretKeys = secretNames(variables);
	const store = (update: (uses: AgentSecretUse[]) => AgentSecretUse[]) =>
		client.setQueryData<AgentSecretUse[] | null>(key, (uses) =>
			uses ? update(uses) : uses,
		);
	const without = (name: string) => (uses: AgentSecretUse[]) =>
		uses.filter((use) => use.key !== name);

	const save = async (on: AgentUseSubject, hosts: string[]) => {
		if (!target) return;
		const editing = hostsOf(on.key) !== undefined;
		const saved = await saveAgentUse(target, on.key, hosts);
		if (on.local !== null) {
			try {
				await writeAgentCopy(client, target, secretKeys, on.key, on.local);
			} catch (error) {
				// Nothing half on: a new use without its copy goes again.
				if (!editing) await removeAgentUse(target, on.key).catch(() => {});
				throw new AgentCopyError(error);
			}
		}
		store((uses) => [...without(on.key)(uses), saved]);
		toast.show({
			tone: "success",
			title: t(editing ? "agentUse.toast.saved" : "agentUse.toast.enabled", {
				count: saved.hosts.length,
				name: on.key,
			}),
		});
	};
	const off = useMutation({
		mutationFn: async (on: AgentUseSubject) => {
			if (target) await removeAgentUse(target, on.key);
		},
		onSuccess: (_, on) => {
			store(without(on.key));
			setSubject(null);
			toast.show({
				tone: "info",
				title: t(
					on.hasLocal ? "agentUse.toast.offLocal" : "agentUse.toast.off",
					{
						name: on.key,
					},
				),
			});
		},
		onError: (_, on) =>
			toast.show({
				tone: "error",
				title: t("agentUse.toast.offFailed", { name: on.key }),
			}),
	});

	const uses = query.data;
	const byKey = useMemo(
		() => new Map((uses ?? []).map((use) => [use.key, use.hosts] as const)),
		[uses],
	);
	const hostsOf = (name: string) => byKey.get(name);
	const scope: AgentUseScope | null =
		running && uses
			? {
					hostsOf,
					vault,
					open: setSubject,
					turnOff: (on) => off.mutate(on),
				}
			: null;
	// The server's own word (`agentUse`) counts even before the list loads.
	const keys = agentCopyKeys(localValues, uses);
	const dialog = subject ? (
		<AgentUseDialog
			key={subject.key}
			subject={subject}
			hosts={hostsOf(subject.key)}
			own={ownHostSources(variables, localValues)}
			client={client}
			turningOff={off.isPending}
			onSave={(hosts) => save(subject, hosts)}
			onTurnOff={() => off.mutate(subject)}
			onClose={() => setSubject(null)}
		/>
	) : null;
	return { scope, keys, dialog, secrets: secretKeys };
}
