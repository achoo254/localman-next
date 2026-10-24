import type { Messages } from "../../message-types";

export const vnFakeData: Messages["vnFakeData"] = {
	meta: {
		title: "越南风格假数据生成器",
		description:
			"在浏览器中生成越南风格的测试数据：姓名、按 34 个省级行政区划的地址、手机号码、12 位 CCCD 号码和公司。可复制或下载 CSV、JSON。仅供测试的假数据。",
	},
	page: {
		badge: "测试数据",
		title: "越南风格假数据",
		intro:
			"看起来像越南的姓名、地址、手机号码、CCCD 号码和公司，在你的浏览器中生成。不会发送，也不会保存。",
	},
	notice: {
		title: "仅供测试的假数据",
		text: "所有值均为随机生成，仅用于测试。它们不对应任何真实的人、手机用户、身份证或公司：请勿用于识别任何人或用于正式文件。",
	},
	form: {
		legend: "要生成的数据",
		type: "数据类型",
		count: "数量",
		countHint: "1 到 {max} 条记录。",
		countError: "请输入 1 到 {max} 之间的整数。",
		locale: "数据语言",
		generate: "生成新数据",
	},
	types: {
		person: "人员",
		address: "地址",
		phone: "手机号码",
		cccd: "CCCD 号码",
		company: "公司",
	},
	locales: {
		vi: "越南语",
		en: "英语，无声调",
	},
	view: {
		legend: "预览方式",
		table: "表格",
		json: "JSON",
	},
	columns: {
		fullName: "姓名",
		gender: "性别",
		dateOfBirth: "出生日期",
		cccd: "CCCD",
		street: "门牌和街道",
		ward: "坊",
		province: "省",
		full: "完整地址",
		number: "号码",
		international: "国际格式",
		carrier: "运营商",
		provinceCode: "省代码",
		birthYear: "出生年份",
		name: "名称",
		taxCode: "税号",
		address: "地址",
		phone: "电话",
	},
	genders: {
		male: "男",
		female: "女",
	},
	preview: {
		caption: { other: "{count} 条假记录" },
	},
	actions: {
		copy: "复制 JSON",
		downloadCsv: "下载 CSV",
		downloadJson: "下载 JSON",
		copied: { other: "已将 {count} 条记录复制为 JSON。" },
		copyBlocked: "浏览器阻止了剪贴板。请改为下载 JSON。",
		downloaded: "已下载 {file}。",
	},
	nudge: {
		title: "将这些数据用作 mock API",
		text: "登录后创建带有类似 field 的 resource，生成记录并立即获得 CRUD endpoint。",
		signIn: "登录以创建 resource",
		openProjects: "创建 resource",
	},
	landing: {
		title: "越南风格假数据生成器",
		text: "为你的测试生成姓名、地址、手机号码、CCCD 号码和公司，直接在浏览器中完成，无需登录。",
		link: "打开生成器",
	},
};
