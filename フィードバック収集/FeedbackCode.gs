// クメール語単語アプリ フィードバック収集
//
// セットアップ手順:
// 1. 新規のGoogleスプレッドシートを作成する（例:「単語アプリ フィードバック」）
// 2. 拡張機能 > Apps Script を開き、このファイルの内容をそのままCode.gsに貼り付けて保存する
// 3. 「デプロイ」→「新しいデプロイ」→種類「ウェブアプリ」を選択
//    - 実行するユーザー: 自分
//    - アクセスできるユーザー: 全員
//    でデプロイする
// 4. 発行されたWebアプリのURL（.../exec）を、アプリ側の js/feedback.js にある
//    FEEDBACK_ENDPOINT_URL に設定する
// 5. コード変更のたびに「デプロイを管理」→新バージョンとして再デプロイが必要（URLは変わらない）

var SHEET_FEEDBACK = 'フィードバック';
var SHEET_SUMMARY = '集計';

function ensureFeedbackSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_FEEDBACK)) {
    var sh = ss.insertSheet(SHEET_FEEDBACK);
    sh.getRange(1, 1, 1, 5).setValues([['送信日時', '評価(1-5)', '内容', 'アプリバージョン', '学習者名(任意)']]);
  }
}

function doPost(e) {
  ensureFeedbackSheet_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FEEDBACK);
  var params = JSON.parse(e.postData.contents);
  sh.appendRow([
    new Date(),
    params.rating || '',
    params.message || '',
    params.appVersion || '',
    params.profileName || ''
  ]);
  updateFeedbackSummary_();
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

// 件数・平均評価・直近のコメントを「集計」シートに自動反映する
function updateFeedbackSummary_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_FEEDBACK);
  var last = sh.getLastRow();
  var summary = ss.getSheetByName(SHEET_SUMMARY) || ss.insertSheet(SHEET_SUMMARY);
  summary.clear();
  if (last < 2) return;

  var values = sh.getRange(2, 1, last - 1, 5).getValues();
  var count = values.length;
  var sum = 0, ratedCount = 0;
  var ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  values.forEach(function (row) {
    var rating = Number(row[1]);
    if (rating) {
      sum += rating;
      ratedCount++;
      ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
    }
  });
  var avg = ratedCount > 0 ? (sum / ratedCount).toFixed(2) : '';

  summary.appendRow(['更新日時', new Date()]);
  summary.appendRow(['件数', count]);
  summary.appendRow(['平均評価', avg]);
  summary.appendRow(['', '']);
  summary.appendRow(['評価の内訳', '']);
  [5, 4, 3, 2, 1].forEach(function (rating) {
    summary.appendRow(['★' + rating, ratingCounts[rating]]);
  });
  summary.appendRow(['', '']);
  summary.appendRow(['直近のコメント（新しい順・最大10件）', '']);
  values.slice().reverse().filter(function (row) { return row[2]; }).slice(0, 10).forEach(function (row) {
    summary.appendRow([Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), 'yyyy-MM-dd'), row[2]]);
  });
}
