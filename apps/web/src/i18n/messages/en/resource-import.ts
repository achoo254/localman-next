/** "Import resource" dialog: sources, preview, errors and notes. */
export const resourceImport = {
	entry: "Import",
	title: "Import resource",
	description:
		"Create a resource from sample JSON, an OpenAPI document or a CSV/JSON file.",
	tabs: { json: "Sample JSON", openapi: "OpenAPI", file: "CSV or JSON file" },
	json: {
		label: "Sample JSON",
		hint: "Paste one object or an array of objects. Each object becomes a record (up to {max}).",
	},
	openapi: {
		label: "OpenAPI document",
		chooseFile: "Choose file",
		hint: "OpenAPI 3.0 or 3.1 as JSON, up to 2 MB. Convert YAML to JSON first. Only references inside the document (<code>#/components/…</code>) are read.",
		schema: "Schema",
		schemaHint: {
			one: "{count} schema in <code>components.schemas</code>.",
			other:
				"{count} schemas in <code>components.schemas</code>. Pick the one that becomes the resource.",
		},
		related: "Also create related resources",
		relatedOn:
			"Schemas referenced with <code>$ref</code> become nested resources.",
		relatedOff: "Referenced schemas become Object fields.",
	},
	file: {
		choose: "Choose a CSV or JSON file",
		drop: "or drop it here · up to 2 MB",
		hint: "CSV: the first row is the header, values separated by commas, UTF-8. Types are guessed from the first 100 rows.",
		chosen: "{name} · {size} KB",
		remove: "Remove file",
		reading: "Reading file…",
	},
	preview: {
		title: "Preview",
		empty:
			"Paste or choose a source to see the schema and the first 5 records here.",
		loading: "Building preview…",
		ready: "Preview ready: {fields}, {records}.",
		fields: { one: "{count} field", other: "{count} fields" },
		schema: "Schema",
		field: "Field",
		type: "Type",
		method: "Faker method",
		firstRecords: "First {shown} of {count} records",
		sample: "Sample records generated from the schema",
		sampleNote:
			"The resource starts empty. Click its gray bar to generate data.",
		alsoCreates: "Also creates:",
		relatedName: "Name of related resource {name}",
		truncated:
			"The source has more than {max} records. Only the first {max} will be imported.",
		notes: { one: "{count} note", other: "{count} notes" },
		showAll: "Show all {count}",
		rowsRegion: "Records preview",
	},
	nameLabel: "Resource name",
	planRoom: {
		one: "This creates {count} resource, but the project has room for {left} more on its owner's plan.",
		other:
			"This creates {count} resources, but the project has room for {left} more on its owner's plan.",
	},
	planRoomCollaborator:
		"Turn off related resources, or ask the project owner to upgrade.",
	managePlan: "Manage plan",
	submit: "Create resource",
	creating: "Creating…",
	errors: {
		tooLarge:
			"The file is {size} KB, over the 2 MB limit. Use a smaller file or split it.",
		pastedTooLarge: "The pasted text is over 2 MB. Paste a smaller sample.",
		inputTooLarge: "The source is over 2 MB. Use a smaller one.",
		payloadTooLarge:
			"The source is too large to send once encoded, for example because of many quotes or line breaks. Use a smaller one.",
		fileType: "Choose a .csv or .json file.",
		readFailed: "Couldn't read the file. Choose it again.",
		jsonShape:
			"Paste a JSON object or an array of objects. Other values can't become records.",
		jsonEmpty:
			"The array is empty, so there are no fields to read. Paste at least one object.",
		invalidJson: "This isn't valid JSON. Check it and try again.",
		invalidCsv:
			"Couldn't read this CSV. Check that the first row names the columns.",
		notOpenApi:
			"This isn't an OpenAPI 3.x document. Check that it's JSON with an <code>openapi</code> field of 3.0 or 3.1.",
		schemaNotFound: "There's no schema named “{name}”. Pick one from the list.",
		refCycle:
			"These schemas refer to each other in a loop: <code>{cycle}</code>. Pick another schema, or remove the loop from the document and try again.",
		externalRef:
			"<code>{ref}</code> points outside this document. Localman doesn't fetch other files or URLs. Copy that schema into the document and try again.",
		tooDeep: "The schema nests more than {max} levels. Pick a smaller schema.",
		tooComplex:
			"The schema has too many fields or references to import. Pick a smaller schema.",
		noFields:
			"No fields found. The source needs at least one property besides <code>id</code>.",
		csvEmpty: "The file has no data rows.",
		csvQuote: "Data row {row} has a quote that never closes.",
		encoding: "The file isn't UTF-8 text. Save it as UTF-8 and try again.",
		nameDuplicate: "Another imported resource already has this name.",
	},
	warnings: {
		renamed: "Renamed “{from}” to <code>{to}</code>.",
		skipped: "Skipped <code>{path}</code>.",
		unsupported:
			"<code>{path}</code> uses something Localman can't map, so it was imported as {as}.",
		mixedTypes:
			"<code>{field}</code> has values of several types ({types}), so it was imported as String.",
		emptyValues:
			"<code>{field}</code> is always empty, so it was imported as {as}.",
		enumValues:
			"<code>{field}</code> allows only {values}. Generated data doesn't keep to this list.",
		foreignKey: "<code>{field}</code> looks like the id of another resource.",
		keptAsArray: "<code>{path}</code> was kept as an Array field.",
		notObjects: {
			one: "{count} item of <code>{path}</code> isn't an object and was skipped.",
			other:
				"{count} items of <code>{path}</code> aren't objects and were skipped.",
		},
		tooManyFields: "Only the first {max} fields were kept.",
		tooManyResources:
			"Only {max} resources can be imported at once. The rest were skipped.",
		tooManyRecords: "Only the first {max} records will be imported.",
		resourceTooLarge:
			"The records are too large for one resource, so the last ones were left out.",
		recordsTooLarge: {
			one: "{count} record is over 32 KB and was left out.",
			other: "{count} records are over 32 KB and were left out.",
		},
		duplicateIds: {
			one: "{count} record repeats an id used before it.",
			other: "{count} records repeat an id used before them.",
		},
		idsRenumbered: {
			one: "{count} record got a new id.",
			other: "{count} records got new ids.",
		},
		csvRowCells:
			"Row {row} has {found} columns, but the header has {expected}. Check for a missing quote or an extra comma.",
		csvMoreRows: {
			one: "{count} more row is like this.",
			other: "{count} more rows are like this.",
		},
		moreWarnings: {
			one: "{count} more note isn't shown.",
			other: "{count} more notes aren't shown.",
		},
	},
} as const;
