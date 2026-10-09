/** Projects page: list, project form, menu, delete and mock URL rotation. */
export const projects = {
	title: "Projects",
	add: "Create a new project",
	list: {
		loading: "Loading projects…",
		loadFailed: "Couldn't load your projects",
		emptyTitle: "No projects yet",
		emptyBody:
			"A project holds your mock resources and endpoints. Create your first project to get started.",
		create: "Create project",
	},
	row: {
		invited: "Invited",
		ownedBy: "Project of {owner}",
		ownerFallback: "someone else",
		collaborators: {
			one: "{count} collaborator",
			other: "{count} collaborators",
		},
	},
	menu: {
		trigger: "Options for {name}",
		collaborators: "Collaborators",
		clone: "Duplicate",
		edit: "Edit",
		delete: "Delete",
	},
	form: {
		titleNew: "New project",
		titleEdit: "Edit project",
		create: "Create project",
		save: "Save changes",
		nameLabel: "Project name",
		prefixHint:
			"Added before every endpoint, for example <code>/api/v1</code>. Leave it empty if you don't need one. Use only letters, numbers, <code>-</code>, <code>_</code> and <code>/</code>.",
		preview: "Preview",
	},
	validation: {
		nameRequired: "Enter a project name.",
		nameTooLong: "Names can be at most {max} characters.",
		nameStart: "Names must start with a letter or number.",
		namePattern:
			"Names can only contain letters, numbers, spaces, -, _ and parentheses.",
		prefixTooLong: "The prefix can be at most {max} characters.",
		prefixPattern:
			"The prefix can only contain unaccented letters, numbers, -, _ and /.",
	},
	toast: {
		created: "Created project {name}.",
		updated: "Updated project {name}.",
		cloned: "Duplicated as {name}.",
		deleted: "Deleted project {name}.",
	},
	delete: {
		title: "Delete project",
		question: "Delete “<code>{name}</code>”?",
		confirm: "Delete project",
		checking: "Checking related data…",
		summary: "This also deletes {items}.",
		separator: ", ",
		irreversible: "All its data will be deleted. This can't be undone.",
		kinds: {
			resources: { one: "{count} resource", other: "{count} resources" },
			records: { one: "{count} data record", other: "{count} data records" },
			collaborators: {
				one: "{count} collaborator",
				other: "{count} collaborators",
			},
			mcpTokens: { one: "{count} MCP token", other: "{count} MCP tokens" },
		},
	},
	rotate: {
		title: "Change mock URL",
		question: "Change the mock URL of {name}?",
		confirm: "Change URL",
		checking: "Checking collaborators…",
		noCollaborators: "This project has no collaborators yet.",
		notify: {
			one: "{count} collaborator will get a notification with the new URL.",
			other: "{count} collaborators will get a notification with the new URL.",
		},
		oldStops:
			"The old URL stops working right away. Any frontend or tool calling it must switch to the new URL.",
		mcp: "The MCP URL changes too; agents that added the old URL must add it again.",
		done: "Mock URL changed",
		doneHint: "Update the new URL in the frontend and tools that use it.",
	},
} as const;
