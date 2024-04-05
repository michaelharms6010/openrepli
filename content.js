const url = "https://api.openai.com/v1/chat/completions";

function cleanGPTReplyText(str) {
  return str.replace(/^"|"$/ig, "")
}

function showLoadingSpinner() {
  const loadingSVG = document.createElement("div");
  loadingSVG.id = "OpenRepli-spinner";
  loadingSVG.className = "loading-spinner";
  loadingSVG.style.marginRight = "10px";
  loadingSVG.innerHTML = `
    <svg
      id="loading-spinner"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid"
      class="loading-svg"
      height="20" width="20"
      >
        <circle cx="50" cy="50" fill="none" stroke="#2D907A" stroke-width="12" r="40" stroke-dasharray="188.49555921538757 64.83185307179586">
          <animateTransform
            attributeName="transform"
            type="rotate"
            repeatCount="indefinite"
            dur="1s"
            keyTimes="0;1"
            values="0 50 50;360 50 50"
          ></animateTransform>
        </circle>
    </svg>
  `;

  const targetElement = document.querySelector('div[data-testid="tweetButton"');
  targetElement.parentNode.insertBefore(loadingSVG, targetElement);

  const replyButton = document.querySelector("#OpenRepli-button");
  replyButton.style.visibility = "hidden";
}

function hideLoadingSpinner() {
  const element = document.querySelector("#OpenRepli-spinner");
  element.remove();

  const replyButton = document.querySelector("#OpenRepli-button");
  replyButton.style.visibility = "visible";
}

function findClosestInputTwitter(el) {
  const inputEl = el.querySelector(
    'div[data-testid^="tweetTextarea_"][role="textbox"]'
  );
  if (inputEl) {
    return inputEl;
  }
  if (!el.parentElement) {
    return null;
  } else {
    return findClosestInputTwitter(el.parentElement);
  }
}

const setTweetReply = async (element, text) => {
  element.focus();

  // Clear existing text in the element
  if (element.nodeName === "INPUT" || element.nodeName === "TEXTAREA") {
    element.select(); // Selects existing text in input or textarea elements
  } else if (element.contentEditable === "true") {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  await navigator.clipboard.writeText(text);

  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: new DataTransfer(),
  });
  pasteEvent.clipboardData.setData("text/plain", text);
  element.dispatchEvent(pasteEvent);

  await navigator.clipboard.writeText("");
};

var genericErrMsg =
  "Something went wrong. Please make sure you have saved the correct API key.";

function showModal(error) {
  const modal = document.createElement("div");
  modal.setAttribute("id", "OpenRepli-modal");
  modal.style.cssText = `
      display: block;
      position: fixed;
      padding: 30px;
      z-index: 100000;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 300px;
      height: 150px;
      overflow: auto;
      border-radius: 10px;
      background-color: #edf0fb;
      font-family: Helvetica Neue;
  `;

  const header = document.createElement("div");
  header.innerHTML = "OpenRepli";
  header.style.cssText = `
      letter-spacing: 0.025em;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      color: black;
  `;

  const message = document.createElement("p");
  message.innerHTML = error;
  message.style.cssText = `
      margin-top: 25px;
      text-align: left;
      letter-spacing: 0.0125em;
      color: black;
      font-size: 14px;
  `;

  const button = document.createElement("button");
  button.innerHTML = "Close";
  button.style.cssText = `
      display: inline-block;
      margin-left: auto;
      margin-top: 8px;
      outline: none;
      border: none;
      border-radius: 20px;
      background-color: #2D907A;
      letter-spacing: 0.0125em;
      padding: 10px 20px;
      color: white;
      cursor: pointer;
      width: 100%;
  `;
  button.addEventListener("click", function () {
    document.getElementById("OpenRepli-modal").remove();
  });

  modal.appendChild(header);
  modal.appendChild(message);
  modal.appendChild(button);

  document.body.appendChild(modal);
}

const tuningInstructions = `It is important your reply is not too formulaic. Keep it brief, don't overuse emojis or hashtags, and try to make it personal and fun.`

async function getCustomInstructions() {
  const customInstructions = await chrome.storage.local.get(["gpt-custom-instructions"]);
  return `${customInstructions ? `These instructions are extremely important. ${customInstructions["gpt-custom-instructions"]}` : ''}`
}

async function buildTwitterPromptText(user, tweet) {
  return `Write a response to the below tweet. Be fun and flip.
Return only the post text, do not include explanations, or wrap the text in quotes. 
${await getCustomInstructions()}
Here is the tweet, by ${user}:
${tweet}
`
}

async function buildLinkedInPromptText(user, post) {
  return `Write a response to the below LinkedIn post. Be professional and fun.
Remember the goal is to network, showing business and technical savvy where possible.
Return only the post text, do not include explanations, or wrap the text in quotes. 
${await getCustomInstructions()}
Here is the post, by ${user}:
${post}
`
}

async function getChatCompletion(prompt) {
  const openaiApiKey = await fetchApiToken()
  const savedGptModel = await chrome.storage.local.get(["gpt-model"]);
  const gptModel = savedGptModel ? savedGptModel['gpt-model'] : 'gpt-4-turbo-preview'

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: gptModel,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  })
}

async function fetchApiToken() {
  const storedKey = await chrome.storage.local.get(["gpt-api-key"]);
  return storedKey["gpt-api-key"];
}

async function generateTweetReply() {
  var tweetTextDiv = document.querySelector('div[data-testid="tweetText"]');
  var tweet = tweetTextDiv.innerText;

  var user = document.querySelector(
    '[data-testid="tweet"] [data-testid="User-Name"]'
  ).children[0].children[0].children[0].children[0].children[0].innerText;

  showLoadingSpinner();

  const prompt = await buildTwitterPromptText(user, tweet)
  const response = await getChatCompletion(prompt)

  if (!response.ok) {
    console.log(await response.json())
    showModal(genericErrMsg);
    hideLoadingSpinner();
    return;
  }

  const resp = await response.json();

  var inputDiv = findClosestInputTwitter(tweetTextDiv);

  hideLoadingSpinner();

  setTweetReply(inputDiv, cleanGPTReplyText(resp.choices[0].message.content));
}

async function injectTwitterButton() {
  await new Promise((r) => setTimeout(r, 100));

  const targetElement = document.querySelector('div[data-testid="tweetButton"');
  if (!targetElement) return
  // Checks for replies and ignores main tweets
  if (targetElement.innerText == "Post") {
    return;
  }

  const button = document.createElement("button");
  button.id = "OpenRepli-button";
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="artdeco-button__icon" height="20" width="20">
      <path fill-rule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z" clip-rule="evenodd" />
    </svg>
  `;
  button.style.borderRadius = "50px";
  button.style.border = "None";
  button.style.color = "#2D907A";
  button.style.background = "transparent";
  button.style.cursor = "pointer";
  button.style.fontWeight = 600;
  button.style.marginRight = "10px";

  button.addEventListener("click", generateTweetReply);
  targetElement.parentNode.insertBefore(button, targetElement);
}

const findClosestInputLinkedIn = (el) => {
  const inputEl = el.querySelector('div.ql-editor[role="textbox"]');
  if (inputEl) {
    return inputEl;
  }
  if (!el.parentElement) {
    return null;
  } else {
    return findClosestInputLinkedIn(el.parentElement);
  }
};

const findClosestPostLinkedIn = (el) => {
  const target = el.querySelector(
    'div[class~="feed-shared-update-v2__description-wrapper"]'
  );
  if (target) {
    return target;
  }
  if (!el.parentElement) {
    return null;
  } else {
    return findClosestPostLinkedIn(el.parentElement);
  }
};

function findClosestReplyButton(el) {
  const target = el.querySelector("#OpenRepli-button");
  if (target) {
    return target;
  }
  if (!el.parentElement) {
    return null;
  } else {
    return findClosestReplyButton(el.parentElement);
  }
}

function findClosestLinkedInUser(el) {
  const target = el.querySelector(
    'span[class~="update-components-actor__name"]'
  );
  if (target) {
    return target;
  }
  if (!el.parentElement) {
    return null;
  } else {
    return findClosestLinkedInUser(el.parentElement);
  }
}

function showLinkedInLoadingSpinner(replyButton) {
  replyButton.innerHTML = `
    <svg
    id="loading-spinner"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid"
    class="loading-svg"
    height="20" width="20"
    >
      <circle cx="50" cy="50" fill="none" stroke="#2D907A" stroke-width="12" r="40" stroke-dasharray="188.49555921538757 64.83185307179586">
        <animateTransform
          attributeName="transform"
          type="rotate"
          repeatCount="indefinite"
          dur="1s"
          keyTimes="0;1"
          values="0 50 50;360 50 50"
        ></animateTransform>
      </circle>
  </svg>
  `;
}



function hideLinkedInLoadingSpinner(replyButton) {
  replyButton.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="artdeco-button__icon" height="24" width="24">
    <path style="fill: #2D907A" fill-rule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z" clip-rule="evenodd" />
  </svg>`;
}

async function generateLinkedInReply(event) {
  const post = findClosestPostLinkedIn(event.target);
  if (post) {
    content = post.children[0].children[0].innerText;
  }

  const user = findClosestLinkedInUser(post).children[0].children[0].innerText;

  var replyButton = findClosestReplyButton(post);
  showLinkedInLoadingSpinner(replyButton);
  const prompt = await buildLinkedInPromptText(user, content)
  const response = await getChatCompletion(prompt)

  if (!response.ok) {
    console.log(response)
    showModal(genericErrMsg);
    hideLinkedInLoadingSpinner(replyButton);
    return;
  }

  const resp = await response.json();

  hideLinkedInLoadingSpinner(replyButton);

  var input = findClosestInputLinkedIn(post);
  input.innerHTML = "<p>" + cleanGPTReplyText(resp.choices[0].message.content) + "</p>";
}

async function injectLinkedInButton() {
  linkedInObserver.disconnect();

  await new Promise((r) => setTimeout(r, 100));

  var targetElements = document.querySelectorAll(
    'svg[data-test-icon="emoji-medium"]'
  );

  for (i = 0; i < targetElements.length; i++) {
    var targetElement = targetElements[i];

    var parentBox =
      targetElement.parentElement.parentElement.parentElement.parentElement;

    var input = findClosestInputLinkedIn(targetElement);

    if (parentBox.children.length < 3) {
      const replyButton = document.createElement("div");
      replyButton.id = "OpenRepli-button";
      replyButton.className =
        "comments-comment-box__detour-icons artdeco-button artdeco-button--circle artdeco-button--muted artdeco-button--2 artdeco-button--tertiary ember-view";
      replyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="artdeco-button__icon" height="24" width="24">
      <path style="fill: #2D907A" fill-rule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z" clip-rule="evenodd" />
    </svg>
    `;

      replyButton.addEventListener("click", generateLinkedInReply);

      // if (input.getAttribute("data-placeholder") == "Add a comment…") {
      parentBox.insertBefore(
        replyButton,
        targetElement.parentElement.parentElement.parentElement
      );
      // }
    }
  }
  linkedInObserver.observe(document.body, { childList: true, subtree: true });
}

const linkedInObserver = new MutationObserver(async function (mutationsList) {
  for (let index = 0; index < mutationsList.length; index++) {
    const mutation = mutationsList[index];
    if (mutation.type === "childList") {
      let finished = await injectLinkedInButton();
      if (finished) {
        break;
      }
    }
  }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "twitter") {
    if (
      window.location.href.includes("https://twitter.com/compose/post") ||
      window.location.href.includes("https://pro.twitter.com/compose/post")
    ) {
      injectTwitterButton();
    } else if (window.location.href.includes("https://www.linkedin.com")) {
      linkedInObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }
});
