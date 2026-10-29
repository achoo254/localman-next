import type { Messages } from "../../message-types";

export const resourceImport: Messages["resourceImport"] = {
	entry: "导入",
	title: "导入 resource",
	description: "从示例 JSON、OpenAPI 文档或 CSV/JSON 文件创建 resource。",
	tabs: { json: "示例 JSON", openapi: "OpenAPI", file: "CSV 或 JSON 文件" },
	json: {
		label: "示例 JSON",
		hint: "粘贴一个对象或对象数组。每个对象成为一条记录（最多 {max} 条）。",
	},
	openapi: {
		label: "OpenAPI 文档",
		chooseFile: "选择文件",
		hint: "JSON 格式的 OpenAPI 3.0 或 3.1，最大 2 MB。请先将 YAML 转为 JSON。只读取文档内部的引用（<code>#/components/…</code>）。",
		schema: "Schema",
		schemaHint: {
			other:
				"<code>components.schemas</code> 中有 {count} 个 schema。选择要成为 resource 的那个。",
		},
		related: "同时创建相关 resource",
		relatedOn: "通过 <code>$ref</code> 引用的 schema 会成为嵌套 resource。",
		relatedOff: "被引用的 schema 会成为 Object 类型的 field。",
	},
	file: {
		choose: "选择 CSV 或 JSON 文件",
		drop: "或拖放到这里 · 最大 2 MB",
		hint: "CSV：第一行为表头，值以逗号分隔，UTF-8 编码。类型根据前 100 行推断。",
		chosen: "{name} · {size} KB",
		remove: "移除文件",
		reading: "正在读取文件…",
	},
	preview: {
		title: "预览",
		empty: "粘贴或选择来源后，这里会显示 schema 和前 5 条记录。",
		loading: "正在生成预览…",
		ready: "预览已就绪：{fields}，{records}。",
		fields: { other: "{count} 个 field" },
		schema: "Schema",
		field: "Field",
		type: "类型",
		method: "Faker 方法",
		firstRecords: "前 {shown} 条，共 {count} 条记录",
		sample: "根据 schema 生成的示例记录",
		sampleNote: "Resource 创建后为空。点击它的灰色条即可生成数据。",
		alsoCreates: "还会创建：",
		relatedName: "相关 resource {name} 的名称",
		truncated: "来源中的记录超过 {max} 条，只会导入前 {max} 条。",
		notes: { other: "{count} 条说明" },
		showAll: "显示全部 {count} 条",
		rowsRegion: "记录预览",
	},
	nameLabel: "Resource 名称",
	planRoom: {
		other: "这会创建 {count} 个 resource，但 project 只剩 {left} 个名额。",
	},
	planRoomHint: "请关闭相关 resource，或删除不再使用的 resource。",
	submit: "创建 resource",
	errors: {
		tooLarge:
			"文件大小为 {size} KB，超过 2 MB 的上限。请使用更小的文件或拆分文件。",
		pastedTooLarge: "粘贴的内容超过 2 MB，请粘贴更小的示例。",
		inputTooLarge: "来源超过 2 MB，请使用更小的来源。",
		payloadTooLarge:
			"来源编码后过大，无法发送（例如引号或换行过多）。请使用更小的来源。",
		fileType: "请选择 .csv 或 .json 文件。",
		readFailed: "无法读取文件，请重新选择。",
		jsonShape: "请粘贴一个 JSON 对象或对象数组。其他值无法成为记录。",
		jsonEmpty: "数组为空，没有可读取的 field。请至少粘贴一个对象。",
		invalidJson: "这不是有效的 JSON，请检查后重试。",
		invalidCsv: "无法读取此 CSV，请检查第一行是否为各列命名。",
		notOpenApi:
			"这不是 OpenAPI 3.x 文档。请确认它是 JSON，且 <code>openapi</code> 字段为 3.0 或 3.1。",
		schemaNotFound: "没有名为“{name}”的 schema，请从列表中选择。",
		refCycle:
			"这些 schema 相互循环引用：<code>{cycle}</code>。请选择其他 schema，或从文档中移除循环后重试。",
		externalRef:
			"<code>{ref}</code> 指向文档外部。Localman 不会获取其他文件或 URL。请将该 schema 复制到文档中后重试。",
		tooDeep: "Schema 嵌套超过 {max} 层，请选择更小的 schema。",
		tooComplex: "Schema 的 field 或引用太多，无法导入。请选择更小的 schema。",
		noFields: "未找到 field。来源除 <code>id</code> 外至少需要一个属性。",
		csvEmpty: "文件中没有数据行。",
		csvQuote: "第 {row} 条数据行有未闭合的引号。",
		encoding: "文件不是 UTF-8 文本。请另存为 UTF-8 后重试。",
		nameDuplicate: "本次导入中已有其他 resource 使用此名称。",
	},
	warnings: {
		renamed: "已将“{from}”重命名为 <code>{to}</code>。",
		skipped: "已跳过 <code>{path}</code>。",
		unsupported:
			"<code>{path}</code> 使用了 Localman 无法映射的结构，已导入为 {as}。",
		mixedTypes:
			"<code>{field}</code> 的值有多种类型（{types}），已导入为 String。",
		emptyValues: "<code>{field}</code> 始终为空，已导入为 {as}。",
		enumValues:
			"<code>{field}</code> 只允许 {values}。生成的数据不会遵循此列表。",
		foreignKey: "<code>{field}</code> 看起来是另一个 resource 的 id。",
		keptAsArray: "<code>{path}</code> 保留为 Array 类型的 field。",
		notObjects: {
			other: "<code>{path}</code> 中有 {count} 项不是对象，已跳过。",
		},
		tooManyFields: "只保留了前 {max} 个 field。",
		tooManyResources: "一次最多导入 {max} 个 resource，其余已跳过。",
		tooManyRecords: "只会导入前 {max} 条记录。",
		resourceTooLarge: "记录对一个 resource 来说太大，已省略最后的部分记录。",
		recordsTooLarge: { other: "{count} 条记录超过 32 KB，已省略。" },
		duplicateIds: { other: "{count} 条记录重复使用了之前的 id。" },
		idsRenumbered: { other: "{count} 条记录获得了新的 id。" },
		csvRowCells:
			"第 {row} 行有 {found} 列，但表头有 {expected} 列。请检查是否缺少引号或多了逗号。",
		csvMoreRows: { other: "还有 {count} 行也是这样。" },
		moreWarnings: { other: "还有 {count} 条说明未显示。" },
	},
};
