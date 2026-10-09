/** Project page: endpoint card, resources card and data actions. */
export const projectDetail = {
	loading: "Loading project…",
	loadFailed: "Couldn't load the project",
	missing: {
		title: "Project not found",
		body: "The project may have been deleted, or you don't have access to it.",
		back: "Back to Projects",
	},
	header: {
		collaborators: "Collaborators",
		collaboratorsCount: "Collaborators · {count}",
	},
	endpoint: {
		secretTip:
			"The project's secret. Anyone with it can call the API, so don't share it publicly.",
		prefixTip: "API prefix. Change it in Edit project.",
		resourceTip:
			"Resource name, for example users. Every resource has GET, POST, PUT and DELETE.",
		generateAll: "Generate all",
		resetAll: "Reset all",
	},
	addResource: "Add resource",
	resources: {
		loading: "Loading resources…",
		loadFailed: "Couldn't load the resources",
		empty:
			"No resources yet. A resource is a data table with its own CRUD endpoints.",
		count: { one: "{count} resource", other: "{count} resources" },
	},
	planLimit: "This project has reached the resource limit on its owner's plan.",
	toast: {
		created: "Created resource <code>{name}</code>.",
		createdHint: "Click the gray bar to generate data.",
		updated: "Updated resource <code>{name}</code>.",
		deleted: "Deleted resource <code>{name}</code>.",
		dataUpdated: "Data updated",
		recordsFor: {
			one: "<b>{count}</b> record for <code>{name}</code>.",
			other: "<b>{count}</b> records for <code>{name}</code>.",
		},
		generated: "Data generated",
		reset: "Data reset",
		noRecords: "<code>{name}</code> has no records now.",
		generatedAll: {
			one: "<b>{count}</b> resource has new data.",
			other: "<b>{count}</b> resources have new data.",
		},
		nested: "Nested <code>{name}</code> into <code>{target}</code>.",
		movedToRoot: "Moved <code>{name}</code> to the root.",
		oldDataReset: "The old data was reset.",
	},
	generate: {
		title: "Generate data",
		question: {
			one: "Generate {count} record for “{name}”?",
			other: "Generate {count} records for “{name}”?",
		},
		clearTitle: "Delete data",
		clearQuestion: "Delete every record of “{name}”?",
	},
	generateAll: {
		empty: "This project has no resources yet.",
		question: "Replace the existing data?",
		lead: "These resources already have data and will be generated again:",
	},
	resetAll: {
		nothing: "There's no data to reset yet.",
		question: "Delete all records?",
		lead: "Every resource goes back to 0 records; schemas and endpoints stay as they are:",
		confirm: "Reset data",
	},
	move: {
		title: "Move resource",
		nestQuestion: "Nest “{name}” into “{target}”?",
		rootQuestion: "Move “{name}” to the root?",
		lead: "This data belongs to the old parent resource and will be reset:",
		confirm: "Move",
	},
} as const;
