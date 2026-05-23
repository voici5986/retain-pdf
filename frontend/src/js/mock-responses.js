import { MOCK_MARKDOWN_CONTENT } from "./mock-constants.js";
import { getMockJobMarkdown } from "./mock-markdown.js";

function mockPdfBytes(label = "Mock PDF") {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 68 >>
stream
BT
/F1 24 Tf
72 760 Td
(${label}) Tj
0 -36 Td
(RetainPDF Mock Preview) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000248 00000 n 
0000000366 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
436
%%EOF`;
  return new TextEncoder().encode(pdf);
}

export async function fetchMockProtected(url) {
  const normalized = `${url || ""}`.trim();
  if (normalized === "mock://translated.pdf") {
    return new Response(mockPdfBytes("Translated PDF"), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  }
  if (normalized === "mock://source.pdf") {
    return new Response(mockPdfBytes("Source PDF"), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  }
  if (normalized === "mock://bundle.zip") {
    return new Response(new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
      },
    });
  }
  if (normalized === "mock://markdown.raw") {
    return new Response(MOCK_MARKDOWN_CONTENT, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  }
  if (normalized === "mock://markdown.json") {
    return new Response(JSON.stringify(getMockJobMarkdown()), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  if (normalized === "mock://markdown/images/page-1/imgs/mock-figure-1.png") {
    const pixel = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12,
      2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 252, 255, 31, 0,
      3, 3, 2, 0, 239, 212, 141, 245, 0, 0, 0, 0, 73, 69, 78, 68,
      174, 66, 96, 130,
    ]);
    return new Response(pixel, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });
  }
  return new Response("mock resource not found", { status: 404 });
}
