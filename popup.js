async function saveForm() {
  var apiKey = document.getElementById("gpt-api-key").value;
  var gptModel = document.getElementById("gpt-model").value;
  var customInstructions = document.getElementById("gpt-custom-instructions").value;
  setLocalValue("gpt-api-key", apiKey);
  setLocalValue("gpt-model", gptModel);
  setLocalValue("gpt-custom-instructions", customInstructions);
  var successMessage = document.querySelector('.save-success');
  successMessage.classList.remove('hidden');
  setTimeout(_ => successMessage.classList.add('hidden'), 3000)
}

function setLocalValue(key, value) {
  chrome.storage.local.set({ [key]: value });
}

async function initializeFormElement(key) {
  chrome.storage.local.get(key, function (items) {
    if (!chrome.runtime.error) {
      if (items[key]) {
        document.getElementById(key).value = items[key];
      }
    }
  });
}

async function initializeForm() {
  initializeFormElement("gpt-api-key");
  initializeFormElement("gpt-model");
  initializeFormElement("gpt-custom-instructions");
}

initializeForm();
document.getElementById("save").addEventListener("click", saveForm);
