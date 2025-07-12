async function submitGoogleForm(url) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
    iframe.onload = () => {
      document.body.removeChild(iframe);
      resolve();
    };
  });
}

export async function uploadTest(test) {
  const url = `https://docs.google.com/forms/d/e/1FAIpQLSfCuhvlQ2KMw4nORV7dOBbmBNNvWZgvJ8jWSD-Tqr6bXOCgsw/formResponse?usp=pp_url&entry.1164512684=${encodeURIComponent(
    JSON.stringify(test)
  )}&submit=Submit`;
  return await submitGoogleForm(url);
}
