export async function text2image(
  text,
  color = "black",
  font = '80px "Pink Script"',
  background = "transparent"
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const safeText = String(text ?? "").trim() || " ";

  await document.fonts.load(font, safeText);
  ctx.font = font;
  const metrics = ctx.measureText(safeText);
  const rawWidth =
    metrics.actualBoundingBoxRight + metrics.actualBoundingBoxLeft;
  const rawHeight =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  canvas.width = Math.max(1, Math.ceil(rawWidth));
  canvas.height = Math.max(1, Math.ceil(rawHeight));
  ctx.font = font;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.fillText(safeText, 0, Math.max(1, metrics.actualBoundingBoxAscent));
  return {
    base64url: canvas.toDataURL("image/png"),
    imgWidth: canvas.width,
    imgHeight: canvas.height,
  };
}
