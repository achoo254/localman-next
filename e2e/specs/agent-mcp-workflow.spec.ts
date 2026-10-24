import { expect, test } from "@playwright/test";
import { callTool, connectAgent } from "../support/mcp-agent.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/**
 * An agent's whole workflow through tools only: a mock and its traffic,
 * a team collection made from the mock and its workspace members, then a
 * fork, a pull request and its merge. (A synced collection waits for Live
 * Mock Sync; sending to the mock is covered by the MCP tests, since the
 * E2E mock lives on a loopback port the proxy refuses.)
 */
test("an agent drives mock, Live Mock Sync, sharing, fork, pull request and merge with tools only", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	const username = uniqueUsername("agent", suffix);
	// The first sign-in starts the Pro period that forks need.
	await signIn(page, username);
	const agent = await connectAgent(page, username, [
		"mock",
		"traffic",
		"client",
		"sharing",
		"sync",
	]);
	try {
		// A mock project with one resource, called once: its log lists it.
		const project = await callTool(agent, "create_project", {
			name: `Agent shop ${suffix}`,
		});
		const projectId = String(project.id);
		const resource = await callTool(agent, "create_resource", {
			projectId,
			name: "users",
		});
		const urls = await callTool(agent, "get_mock_urls", { projectId });
		const [users] = urls.resources as { collectionUrl: string }[];
		const mocked = await fetch(users?.collectionUrl ?? "");
		expect(mocked.status).toBe(200);
		await expect
			.poll(async () =>
				JSON.stringify(
					await callTool(agent, "list_request_logs", { projectId }),
				),
			)
			.toContain("/users");

		// A team workspace, a collection made from the mock, its members.
		const team = await callTool(agent, "create_workspace", {
			name: `Agent team ${suffix}`,
		});
		const source = await callTool(agent, "create_collection", {
			workspaceId: String(team.id),
			name: "Shop API",
			mockProjectId: projectId,
		});
		// Giving people access needs client:share, which the user grants an
		// agent apart; reading who is in the workspace is client:read.
		const members = await callTool(agent, "list_workspace_members", {
			workspaceId: String(team.id),
		});
		expect(JSON.stringify(members)).toContain(username);

		// A collection that follows the mock: renaming the resource moves
		// its requests to the new path, by Live Mock Sync.
		const synced = await callTool(agent, "create_synced_collection", {
			projectId,
			workspaceId: String(team.id),
		});
		const syncedId = String(synced.collectionId);
		await callTool(agent, "update_resource", {
			projectId,
			resourceId: String(resource.id),
			name: "members",
		});
		await expect
			.poll(
				async () => {
					const detail = await callTool(agent, "get_collection", {
						collectionId: syncedId,
					});
					const nodes = detail.nodes as {
						name: string;
						draft?: { url: string };
					}[];
					return nodes.find((n) => n.name === "List members")?.draft?.url;
				},
				{ timeout: 15_000 },
			)
			.toBe("{{baseUrl}}/members");
		const sync = await callTool(agent, "get_collection_sync", {
			collectionId: syncedId,
		});
		expect(sync).toMatchObject({ conflicts: 0, mockUrlChanged: false });

		// Fork into the personal workspace, add a request, pull request, merge.
		const listed = await callTool(agent, "list_workspaces", {});
		const personal = (listed.items as { id: string; type: string }[]).find(
			(ws) => ws.type === "personal",
		);
		const fork = await callTool(agent, "fork_collection", {
			collectionId: String(source.id),
			label: "agent",
			workspaceId: personal?.id ?? "",
		});
		await callTool(agent, "create_collection_node", {
			collectionId: String(fork.id),
			kind: "request",
			parentId: null,
			name: "Agent request",
			draft: {
				name: "Agent request",
				method: "GET",
				url: "https://api.example.com/users",
				params: [],
				headers: [],
				auth: { type: "none" },
				body: {
					type: "none",
					rawLanguage: "json",
					raw: "",
					urlencoded: [],
					formData: [],
					binary: null,
				},
				scripts: { pre: "", post: "" },
				settings: {
					followRedirects: true,
					timeoutMs: 30000,
					sendClientIp: true,
					route: "auto",
				},
			},
		});
		const pr = await callTool(agent, "create_pull_request", {
			collectionId: String(fork.id),
			title: "Add the agent's request",
		});
		const merged = await callTool(agent, "merge_pull_request", {
			pullRequestId: String(pr.id),
		});
		expect(JSON.stringify(merged)).toContain("merged");
		const after = await callTool(agent, "get_collection", {
			collectionId: String(source.id),
		});
		const names = (after.nodes as { name: string }[]).map((node) => node.name);
		expect(names).toContain("Agent request");

		// Changes the agent made are marked as such in the source's changelog.
		const log = await callTool(agent, "get_collection_changelog", {
			collectionId: String(source.id),
		});
		const sessions = log.sessions as { changes: { viaMcp: boolean }[] }[];
		expect(sessions[0]?.changes[0]?.viaMcp).toBe(true);
	} finally {
		await agent.close();
	}
});
