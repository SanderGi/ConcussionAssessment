export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeImageURL(value, baseUrl = globalThis.location?.origin) {
  if (typeof value !== "string" || value.length === 0) return "";
  if (/^data:image\/(?:jpeg|png|gif|webp);base64,/i.test(value)) return value;

  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

const SAFE_INLINE_TAGS = new Set(["A", "BR", "CODE", "EM", "STRONG"]);

export function sanitizeInlineHTML(value, documentApi = globalThis.document) {
  const template = documentApi.createElement("template");
  template.innerHTML = String(value ?? "");

  for (const element of template.content.querySelectorAll("*")) {
    if (!SAFE_INLINE_TAGS.has(element.tagName)) {
      element.replaceWith(documentApi.createTextNode(element.textContent ?? ""));
      continue;
    }

    const href = element.tagName === "A" ? safeImageURL(element.href) : "";
    for (const attribute of [...element.attributes]) {
      element.removeAttribute(attribute.name);
    }
    if (element.tagName === "A" && href) {
      element.href = href;
      element.target = "_blank";
      element.rel = "noopener noreferrer";
    } else if (element.tagName === "A") {
      element.replaceWith(documentApi.createTextNode(element.textContent ?? ""));
    }
  }

  return template.innerHTML;
}
