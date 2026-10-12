/** Resource form, data editor, delete dialog and resource API errors. */
export const resources = {
	records: { one: "{count} record", other: "{count} records" },
	changeLine: {
		one: "{before} → {count} record",
		other: "{before} → {count} records",
	},
	lostLead: "These child resources will lose their data:",
	errors: {
		invalidAt: "Invalid data at “{path}”: {message}",
		invalid: "The submitted data is invalid.",
		templateTooLarge:
			"The object template could produce records larger than 32 KB. Shorten the template.",
		notFound:
			"The resource or project no longer exists. Reload the page to see the latest data.",
		parentHasNoData: "Generate data for the parent resource first.",
		nameTaken: "There's already a resource with this name here.",
		treeCycle:
			"Can't nest a resource into itself or into one of its child resources.",
		fieldConflict:
			"This change gives a field the same name as a generated field (for example userId). Rename or remove that field first.",
		planLimit: "You've used all the resources this account allows.",
		forbidden: "You can only view this project.",
		requestTooLarge: "The submitted data is too large (2 MB max per resource).",
		recordTooLarge:
			"The data has a record over 32 KB. Shorten the records or the template.",
		recordTooLargeOf:
			"The data of {name} has a record over 32 KB. Shorten the records or the template.",
		dataTooLarge:
			"The data is over 2 MB. Reduce the number of records or the size of each record.",
		dataTooLargeOf:
			"The data of {name} is over 2 MB. Reduce the number of records or the size of each record.",
	},
	validation: {
		nameRequired: "Enter a resource name.",
		nameTooLong: "Names can be at most {max} characters.",
		namePattern:
			"Use only unaccented letters, numbers, - and _, starting with a letter or number.",
		nameReserved:
			"The name “{name}” is reserved for the project's MCP endpoint. Pick another name.",
		tooManyFields: "A resource can have at most {max} fields.",
		fieldRequired: "Enter a field name.",
		fieldTooLong: "Field names can be at most {max} characters.",
		fieldPattern:
			"Field names can only use unaccented letters, numbers, _, - and dots.",
		fieldForbidden: "The name “{name}” can't be used.",
		fieldGenerated: "Field “{name}” is generated automatically.",
		fieldDuplicate: "Field “{name}” is a duplicate.",
		fakerMethod: "Pick a Faker method from the list.",
		childRequired: "Pick a child resource.",
		parentOnRoot: "A root resource has no Parent Resource.",
		parentRepeated: "Field “{first}” already reads the parent record.",
		childRepeated: "Field “{first}” already reads this child resource.",
		templateInvalid: "The object template isn't valid JSON.",
		templateNotObject: "The object template must be a JSON object.",
		responseInvalid: "The response template isn't valid JSON.",
		parentKeyRequired: "Enter a parent key.",
		parentKeyTooLong: "The parent key can be at most {max} characters.",
		parentKeyPattern:
			"Use letters, numbers, _ and $, not starting with a number (for example userId).",
		parentKeyId: "“id” is the record's own id. Pick another name.",
		parentKeyTaken: "The field “{name}” already has this name.",
		parentKeyRefused: "This parent key can't be used. Pick another name.",
		parentKeyInData:
			"Records of this resource already have a field “{name}”. Pick another key.",
	},
	form: {
		titleNew: "New resource",
		titleEdit: "Edit resource · <name>{name}</name>",
		create: "Create resource",
		update: "Update",
		nameLabel: "Resource name",
		nameHint:
			"Used as the endpoint path, for example <code>/users</code>. Only unaccented letters, numbers, <code>-</code> and <code>_</code>.",
		childOf: "Child resource of <code>{parent}</code>.",
		schemaHint: "Shape of each record",
		checkMarked: "Check the fields marked in red.",
		parentKeyLabel: "Parent key",
		parentKeyHint:
			"Field that holds the id of the parent <code>{parent}</code> record. Renaming it renames the field the mock returns and its filter, so clients already using the mock must change too.",
		partialTitle: "Saved the resource, not the callbacks",
		partialBody: "{reason} Fix the callbacks, then select Update again.",
	},
	schema: {
		typeOf: "Type of {name}",
		sourceOf: "Source of {name}",
		fieldFallback: "field {position}",
		fieldName: "Field name {position}",
		dataType: "Data type of {label}",
		noMethod: "This type needs no method ({label})",
		fakerMethod: "Faker method of {label}",
		childResource: "Child resource of {label}",
		remove: "Remove field {label}",
		addField: "Add field",
		noMatch: "No method matches.",
		suggested: "suggested",
		suggestedHint: "from the field name<sr>. Pick another method anytime.</sr>",
	},
	template: {
		hint: 'JSON template used instead of the schema above, for complex nested shapes. Values like <code>"$category.method"</code> call Faker (for example <code>"$internet.email"</code>). Leave it empty to use the schema.',
	},
	endpoints: {
		list: "List",
		one: "One record",
		create: "Create",
		update: "Update (PUT, PATCH)",
		delete: "Delete",
		enable: "Enable {endpoint}",
		variables:
			'Template variables: <code>"$mockData"</code> the stored data, <code>"$count"</code> the record count, <code>"$category.method"</code> a Faker value generated on each request (for example <code>"$name.fullName"</code>).',
	},
	data: {
		title: "Data · <name>{name}</name>",
		hint: "Edit directly or paste a new JSON array to replace all the data (up to {max} records).",
		loading: "Loading data…",
		loadFailed: "Couldn't load the data",
		jsonLabel: "JSON data of {name}",
		update: "Update",
		confirmTitle: "Update data",
		confirmQuestion: "Replace the data of “{name}”?",
		notArray: "The data must be a JSON array.",
		tooMany: "Up to {max} records ({count} now).",
		notObject: "Each item must be a JSON object.",
		goToLabel: "Go to id",
		goTo: "Go",
		goToNotFound: "No record has the id “{id}”.",
		goToInvalid: "Fix the JSON first, then search by id.",
		wrap: "Wrap lines",
		scrollLabel: "Scrollable JSON data of {name}",
	},
	delete: {
		title: "Delete resource",
		question: "Delete “<code>{name}</code>”?",
		confirm: "Delete resource",
		body: {
			one: "The schema, endpoints and {count} record of {name} will be deleted.",
			other:
				"The schema, endpoints and {count} records of {name} will be deleted.",
		},
		checking: "Checking child resources…",
		cascadeUnknown: "Every child resource and its data will be deleted too.",
		cascade: {
			one: "This also deletes {count} child resource:",
			other: "This also deletes {count} child resources:",
		},
		irreversible: "This can't be undone.",
	},
} as const;
