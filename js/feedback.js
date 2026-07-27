// アプリ内フィードバックの送信
// GAS Webアプリ（フィードバック収集/FeedbackCode.gs）へ送信し、スプレッドシートに集計される。
// デプロイ後、発行されたWebアプリURLを下の FEEDBACK_ENDPOINT_URL に設定すること。

const FEEDBACK_ENDPOINT_URL = "";

let feedbackSelectedRating = 0;

function initFeedbackForm() {
  document.querySelectorAll("#feedback-rating .feedback-star").forEach((btn) => {
    btn.addEventListener("click", () => {
      feedbackSelectedRating = Number(btn.dataset.rating);
      updateFeedbackStars();
    });
  });
  document.getElementById("feedback-submit-btn").addEventListener("click", submitFeedback);
}

function updateFeedbackStars() {
  document.querySelectorAll("#feedback-rating .feedback-star").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.rating) <= feedbackSelectedRating);
  });
}

function resetFeedbackForm() {
  feedbackSelectedRating = 0;
  updateFeedbackStars();
  document.getElementById("feedback-message").value = "";
}

function submitFeedback() {
  const statusEl = document.getElementById("feedback-status");
  const message = document.getElementById("feedback-message").value.trim();

  if (!feedbackSelectedRating && !message) {
    statusEl.textContent = "評価かコメントのどちらかを入力してください";
    return;
  }
  if (!FEEDBACK_ENDPOINT_URL) {
    statusEl.textContent = "（送信先が未設定です）";
    return;
  }

  statusEl.textContent = "送信中…";
  const profile = getCurrentProfile();

  // GAS Webアプリはブラウザからのfetchに対してCORSヘッダーを返せないため、
  // no-corsモードで送信する（レスポンス内容は読めないが、通信自体は成功する）
  fetch(FEEDBACK_ENDPOINT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      rating: feedbackSelectedRating || "",
      message,
      appVersion: APP_VERSION,
      profileName: profile ? profile.name : "",
    }),
  })
    .then(() => {
      statusEl.textContent = "送信しました。ありがとうございます！";
      resetFeedbackForm();
    })
    .catch(() => {
      statusEl.textContent = "送信に失敗しました。通信環境をご確認のうえ再度お試しください";
    });
}
