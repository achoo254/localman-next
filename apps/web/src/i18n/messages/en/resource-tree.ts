/** Resource tree canvas: project page and landing demo. */
export const resourceTree = {
	rail: {
		addToRoot: "Add to root",
	},
	hint: {
		idle: "Click the dot on the left of a resource to select it, then the dot on the right of another resource to nest it there.",
		selected:
			"Selected <b>{name}</b>. Click the dot on the right of the target resource to nest it, or click the “Add to root” bar. Press Esc to cancel.",
	},
	connector: {
		select: "Select {name} to move",
		nest: "Nest {moving} into {target}",
		selectedFallback: "the selected resource",
	},
	node: {
		open: "Open {url}",
		edit: "Edit",
		editLabel: "Edit {name}",
		data: "Data",
		dataLabel: "Data of {name}",
		delete: "Delete",
		deleteLabel: "Delete {name}",
	},
	generator: {
		label: "Records of {name}",
		value: { one: "{count} record", other: "{count} records" },
		valueBlocked: {
			one: "{count} record. {reason}",
			other: "{count} records. {reason}",
		},
		blockedReason: "Generate data for {parent} first.",
		blockedToast: "Generate data for {parent} before generating {name}.",
		parentFallback: "the parent resource",
	},
	refuse: {
		selectFirst: "Select a resource first: click the dot on its left.",
		missing:
			"This resource no longer exists. Reload the page to update the tree.",
		self: "Can't nest {moving} into itself.",
		alreadyRoot: "{moving} is already at the root.",
		alreadyIn: "{moving} is already in {target}.",
		cycle: "Can't nest {moving} into {target} because it would create a loop.",
		nameTaken: "There's already a resource named {moving} here.",
		tooDeep: "The resource tree can be nested at most {max} levels deep.",
	},
} as const;
