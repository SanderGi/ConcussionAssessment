import { getTest, saveTestResult } from "./testManager.js";
import { sequencePrompt } from "./util/popup.js";

let startTime = 0;
let timer = null;
const section = document.getElementById("dual-task-gait");
section.addEventListener("click", async (e) => {
  if (e.target.tagName === "SPAN") {
    const wasCrossed = e.target.style.textDecoration === "line-through";
    e.target.style.textDecoration = wasCrossed ? "" : "line-through";
    e.target.style.color = wasCrossed ? "" : "darkgreen";
    e.target.style.borderColor = wasCrossed ? "" : "darkgreen";
  }
  if (e.target.tagName === "I" && e.target.dataset.action === "edit-numbers") {
    const newNumbers = await sequencePrompt();
    if (newNumbers !== null) {
      for (const oldnum of e.target.parentElement.querySelectorAll("span")) {
        oldnum.remove();
      }
      for (const num of newNumbers) {
        const span = document.createElement("span");
        span.textContent = num;
        e.target.parentElement.prepend(span);
      }
    }
  }

  const action = e.target.dataset.action;
  if (!action) return;
  if (action.startsWith("start-trial-")) {
    const trial = action.slice("start-trial-".length);
    e.target.textContent = "Stop Timer";
    e.target.classList.remove("button--green");
    e.target.classList.add("button--red");
    e.target.dataset.action = "stop-trial-" + trial;
    const timeSpan = document.createElement("span");
    timeSpan.style.fontFamily = "var(--mono-space)";
    timeSpan.textContent = "0.00";
    e.target.parentElement.prepend(timeSpan);
    startTime = Date.now();
    timer = setInterval(() => {
      timeSpan.textContent = ((Date.now() - startTime) / 1000).toFixed(2);
    }, 100);
  } else if (action.startsWith("stop-trial-")) {
    clearInterval(timer);
    const trial = action.slice("stop-trial-".length);
    const datasection = document.getElementById(
      `dual-task-trial-${trial}-data`
    );

    const redoBtn = document.createElement("i");
    redoBtn.className = "fa-solid fa-rotate-right";
    redoBtn.style.fontSize = "0.8em";
    redoBtn.style.cursor = "pointer";
    redoBtn.onclick = () => {
      datasection.querySelectorAll("span").forEach((el) => {
        el.style.textDecoration = "";
        el.style.color = "";
        el.style.borderColor = "";
      });
      datasection.querySelector(`[data-title="Errors"]`).firstChild.value = 0;
      datasection.querySelector(
        `[data-title="Time (seconds)"]`
      ).innerHTML = `<button data-action="start-trial-${trial}" class="button button--green">Start Timer</button>`;
    };

    const seconds = (Date.now() - startTime) / 1000;
    datasection.lastElementChild.replaceChildren(
      document.createTextNode(seconds.toFixed(2) + " "),
      redoBtn
    );

    const responses = Array.from(datasection.querySelectorAll("span")).map(
      (el) => el.style.textDecoration === "line-through"
    );
    const correctResponses = responses.filter(Boolean);
    datasection.querySelector(`[data-title="Errors"]`).firstChild.value =
      responses.length - correctResponses.length;

    if (trial === "practice") return;
    const test = getTest();
    const accuracy = (correctResponses.length / responses.length) * 100;
    if ((test.dual_task_fastest_time ?? Infinity) > seconds) {
      section.dataset.best_trial = trial;
      saveTestResult("dual_task_fastest_time", seconds);
      saveTestResult("dual_task_accuracy", accuracy);
      saveTestResult(
        "dual_task_starting_integer",
        parseInt(datasection.querySelector("span").textContent)
      );
    }
  }
});
section.addEventListener("input", (e) => {
  if (e.target.tagName === "INPUT") {
    const datasection = e.target.parentElement.parentElement;
    const trial = parseInt(datasection.id.slice("dual-task-trial-".length));
    if (isNaN(trial)) return;

    const responses = Array.from(datasection.querySelectorAll("span")).map(
      (el) => el.style.textDecoration === "line-through"
    );
    const accuracy =
      ((responses.length - e.target.value) / responses.length) * 100;

    const test = getTest();
    if (test.dual_task_fastest_time && section.dataset.best_trial == trial) {
      saveTestResult("dual_task_accuracy", accuracy);
    }
  }
});
