export const USER_STAGE_FLOW = [
  {
    key: "ocr",
    label: "OCR 解析",
    detail: "正在识别 PDF 内容",
    matches: ["ocr", "parse", "mineru", "paddle", "normaliz", "document", "submit", "startup"],
  },
  {
    key: "translate",
    label: "翻译",
    detail: "正在翻译正文内容",
    matches: ["translat"],
  },
  {
    key: "render",
    label: "渲染",
    detail: "正在生成翻译后的 PDF",
    matches: ["render", "sav"],
  },
];

export const USER_STAGE_TOTAL = USER_STAGE_FLOW.length + 1;

export const DETAIL_TEXT_MAP = [
  {
    matches: ["queue", "queued", "pending", "执行槽位", "排队"],
    detail: "排队中，等待可用执行槽位",
  },
  {
    matches: ["启动 ocr", "ocr 子任务", "ocr job"],
    detail: "正在启动 OCR 子任务",
  },
  {
    matches: ["upload", "上传", "提交", "submit"],
    detail: "正在上传 PDF",
  },
  {
    matches: ["poll", "查询", "ocr_processing", "cloud ocr", "云端 ocr", "ocr 识别"],
    detail: "正在执行云端 OCR",
  },
  {
    matches: ["download", "下载相关", "下载结果", "ocr 结果", "整理 ocr"],
    detail: "正在下载并整理 OCR 结果",
  },
  {
    matches: ["ocr_result_ready"],
    detail: "正在整理 OCR 结果",
  },
  {
    matches: ["normaliz", "标准化", "standard", "document"],
    detail: "正在整理 OCR 结果",
  },
  {
    matches: ["continuation_review", "跨栏", "跨页", "连续段"],
    detail: "正在判断跨栏/跨页连续段",
  },
  {
    matches: ["page_policies", "页面策略", "块分类", "分类"],
    detail: "正在判断正文与保留排版内容",
  },
  {
    matches: ["garbled", "乱码"],
    detail: "正在修复乱码候选段",
  },
  {
    matches: ["翻译完成", "开始渲染", "render", "渲染", "生成 pdf"],
    detail: "正在生成翻译后的 PDF",
  },
  {
    matches: ["ocr 完成", "开始翻译", "translat", "翻译"],
    detail: "正在翻译正文内容",
  },
  {
    matches: ["sav", "保存"],
    detail: "正在保存结果文件",
  },
];

export const TRANSLATION_SUBTYPE_LABELS = {
  startup: "启动",
  continuation_review: "跨栏/跨页判断",
  page_policies: "页面策略",
  domain_inference: "领域判断",
  garbled: "乱码修复",
  translation_prepare: "翻译准备",
  translation_batches: "翻译",
};
