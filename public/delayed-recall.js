import { getTest, saveTestResult } from "./testManager.js";

const content = document.getElementById("delayed-recall-content");

document.addEventListener("renderTestSection", async (event) => {
  if (event.detail === "delayed-recall") {
    const test = getTest();
    if (!test.immediate_memory_timestamp) {
      content.innerHTML = /*html*/ `
        <p style="margin-top: 0">The Immediate Memory section must be completed at least 5 minutes before this section. It has not been completed at all.</p>
        <button class="button" onclick="renderTestSection('immediate-memory')">Back to the Immediate Memory section</button>
      `;
      return;
    }

    const seconds_ago = (Date.now() - test.immediate_memory_timestamp) / 1000;
    if (seconds_ago < 300) {
      const timer = setInterval(
        (function callback() {
          const seconds_ago =
            (Date.now() - test.immediate_memory_timestamp) / 1000;
          content.innerHTML = /*html*/ `
          <p style="margin-top: 0">The Immediate Memory section must be completed at least 5 minutes before this section. Delayed Recall will open in ${
            300 - seconds_ago.toFixed(0)
          } seconds.</p>
        `;
          if (seconds_ago >= 300) {
            clearInterval(timer);
            content.innerHTML = "Starting...";
            setupDelayedRecall();
          }
          return callback;
        })(),
        1000
      );
    } else {
      setupDelayedRecall();
    }
  }
});

function setupDelayedRecall() {
  const test = getTest();
  if (!test.delayed_recall_timestamp) {
    saveTestResult("delayed_recall_timestamp", Date.now());
  }
  content.innerHTML = /*html*/ `
    <p style="margin-top: 0">Examiner, read the below instructions and select the words that the athlete can remember from the Immediate Memory section.</p>
    <p style="font-style: italic;">Do you remember the list of words read a few times earlier during the immediate memory section? Tell me as many words from the list as you can
    remember in any order &nbsp; <i class="fa-solid fa-volume-high" onclick="speak(this.parentElement.textContent)"></i></p>
    ${
      test.immediate_memory_words
        ?.map(
          (word) => /*html*/ `
          <label class="left-align green" style="flex-wrap: nowrap; margin-bottom: 0.4em; display: flex; align-items: flex-start; gap: 0.5em; padding-left: 2em;"><input type="checkbox" class="recall-list"/> ${word}.</label>
        `
        )
        ?.join("") ?? "Somehow the list of words was not saved."
    }
    <br>
    <button class="button button--green" onclick="saveTestResult('delayed_recall', getChecked('recall-list').length); saveTestResult('delayed_recall_by_word', [...document.querySelectorAll('.recall-list')].map(el => el.checked)); renderTestSection('results')">View Test Results</button>
  `;
}
