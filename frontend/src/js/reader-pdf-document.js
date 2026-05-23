import * as pdfjsLib from "../../vendor/pdfjs-dist/build/pdf.mjs";
import { apiBase, buildApiHeaders } from "./config.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "../../vendor/pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

const PDFJS_CMAP_URL = new URL("../../vendor/pdfjs-dist/cmaps/", import.meta.url).toString();
const PDFJS_STANDARD_FONT_DATA_URL = new URL("../../vendor/pdfjs-dist/standard_fonts/", import.meta.url).toString();
const READER_RANGE_CHUNK_SIZE = 512 * 1024;

export function resolveReaderArtifactUrl(item) {
  const raw = `${item?.resource_url || item?.resource_path || ""}`.trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return `${apiBase()}${raw}`;
  }
  return `${apiBase()}/${raw.replace(/^\.?\//, "")}`;
}

export async function loadPdfDocument({ itemOrUrl }) {
  const url = typeof itemOrUrl === "string" ? itemOrUrl : resolveReaderArtifactUrl(itemOrUrl);
  if (!url) {
    return null;
  }
  return pdfjsLib.getDocument({
    url,
    httpHeaders: buildApiHeaders(),
    withCredentials: false,
    disableRange: false,
    disableStream: false,
    rangeChunkSize: READER_RANGE_CHUNK_SIZE,
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
  }).promise;
}
