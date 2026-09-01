const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfCuhvlQ2KMw4nORV7dOBbmBNNvWZgvJ8jWSD-Tqr6bXOCgsw/formResponse";
const MAX_FORM_URL_LENGTH = 8_000;
const UPLOAD_TIMEOUT_MS = 30_000;

export class GoogleFormUploadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GoogleFormUploadError";
    this.code = code;
  }
}

export function googleFormURL(test, maxLength = MAX_FORM_URL_LENGTH) {
  const query = new URLSearchParams({
    usp: "pp_url",
    "entry.1164512684": JSON.stringify(test),
    submit: "Submit",
  });
  const url = `${FORM_URL}?${query}`;
  if (url.length > maxLength) {
    throw new GoogleFormUploadError(
      "URL_LIMIT",
      `Research upload URL is ${url.length} characters; limit is ${maxLength}.`
    );
  }
  return url;
}

export function withoutBessPhotos(test) {
  const reduced = { ...test };
  delete reduced.mBESS_pose_error_photos;
  return reduced;
}

async function submitGoogleForm(url) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      iframe.remove();
      callback(value);
    };
    const timeout = setTimeout(
      () =>
        finish(
          reject,
          new GoogleFormUploadError(
            "TIMEOUT",
            "Research upload did not finish in time."
          )
        ),
      UPLOAD_TIMEOUT_MS
    );
    iframe.onload = () => finish(resolve);
    iframe.onerror = () =>
      finish(
        reject,
        new GoogleFormUploadError(
          "NETWORK",
          "Research upload could not reach Google Forms."
        )
      );
    iframe.src = url;
    document.body.appendChild(iframe);
  });
}

export async function uploadTest(test) {
  try {
    await submitGoogleForm(googleFormURL(test));
    return { omittedBessPhotos: false };
  } catch (error) {
    if (
      error?.code !== "URL_LIMIT" ||
      test.mBESS_pose_error_photos === undefined
    ) {
      throw error;
    }
    await submitGoogleForm(googleFormURL(withoutBessPhotos(test)));
    return { omittedBessPhotos: true };
  }
}
