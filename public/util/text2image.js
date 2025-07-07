export async function text2image(
  text,
  color = "black",
  font = '80px "Pink Script"',
  background = "transparent"
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  await document.fonts.load(font, text);
  ctx.font = font;
  const metrics = ctx.measureText(text);
  canvas.width = metrics.actualBoundingBoxRight + metrics.actualBoundingBoxLeft;
  canvas.height =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  ctx.font = font;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, metrics.actualBoundingBoxAscent);
  return {
    base64url: canvas.toDataURL(),
    imgWidth: canvas.width,
    imgHeight: canvas.height,
  };
}
