const fs = require('fs');
const path = require('path');
const audioService = require('./audioService');

/**
 * Generate a standalone interactive HTML quiz file.
 *
 * @param {object} options
 * @param {string} options.title - Quiz title
 * @param {Array} options.questions - Array of question objects
 * @param {string} options.language - UI language: "russian", "english", or "mixed"
 * @param {object} options.audioFiles - Map of questionId → audio file path
 * @param {number} options.maxPlays - Max audio plays per question (DLPT default: 2)
 * @returns {string} Complete HTML string
 */
function generateQuizHTML(options) {
  const {
    title = 'Interactive Quiz',
    questions = [],
    language = 'mixed',
    audioFiles = {},
    maxPlays = 2,
  } = options;

  const ui = getUIStrings(language);

  // Build audio data URIs for embedding
  const audioDataMap = {};
  for (const [questionId, filePath] of Object.entries(audioFiles)) {
    try {
      audioDataMap[questionId] = audioService.toBase64DataURI(filePath);
    } catch {
      // Skip audio that can't be loaded
    }
  }

  const questionsJSON = JSON.stringify(questions);
  const audioJSON = JSON.stringify(audioDataMap);

  return `<!DOCTYPE html>
<html lang="${language === 'russian' ? 'ru' : 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)}</title>
<style>
${getStyles()}
</style>
</head>
<body>
<div id="app">
  <header>
    <h1>${escapeHTML(title)}</h1>
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill"></div>
    </div>
    <div class="progress-text" id="progressText">0 / ${questions.length}</div>
  </header>

  <main id="quizContainer"></main>

  <div id="resultsPanel" class="results hidden">
    <h2>${ui.results}</h2>
    <div class="score" id="scoreDisplay"></div>
    <div class="score-bar">
      <div class="score-fill" id="scoreFill"></div>
    </div>
    <div id="reviewContainer"></div>
    <button class="btn btn-primary" onclick="resetQuiz()">${ui.tryAgain}</button>
  </div>
</div>

<script>
(function() {
  "use strict";

  var questions = ${questionsJSON};
  var audioData = ${audioJSON};
  var maxPlays = ${maxPlays};

  var ui = ${JSON.stringify(ui)};
  var answers = {};
  var playCounters = {};
  var currentQuestion = 0;

  function init() {
    renderQuestion(0);
    updateProgress();
  }

  function renderQuestion(index) {
    var container = document.getElementById("quizContainer");
    var q = questions[index];
    if (!q) return;

    var html = '<div class="question-card">';
    html += '<div class="question-header">';
    html += '<span class="question-number">' + ui.question + " " + (index + 1) + " / " + questions.length + "</span>";
    html += '<span class="question-type badge-' + q.type + '">' + (q.type === "listening" ? ui.listening : ui.reading) + "</span>";
    html += "</div>";

    // Audio player for listening questions
    if (q.type === "listening" && audioData[q.id]) {
      var plays = playCounters[q.id] !== undefined ? playCounters[q.id] : maxPlays;
      playCounters[q.id] = plays;

      html += '<div class="audio-section">';
      html += '<audio id="audio-' + q.id + '" src="' + audioData[q.id] + '" preload="auto"></audio>';
      html += '<button class="btn btn-audio" id="playBtn-' + q.id + '" onclick="playAudio(' + q.id + ')"';
      if (plays <= 0) html += " disabled";
      html += ">" + ui.play + "</button>";
      html += '<span class="play-count" id="playCount-' + q.id + '">' + ui.playsRemaining + ": " + plays + "</span>";
      html += "</div>";
    }

    // Reading passage
    if (q.passage) {
      var passageLang = q.passageLanguage === "russian" ? "ru" : "en";
      html += '<div class="passage" lang="' + passageLang + '">';
      html += '<div class="passage-label">' + (q.passageLanguage === "russian" ? ui.passageRu : ui.passageEn) + "</div>";
      html += "<p>" + escapeHTMLJS(q.passage) + "</p>";
      html += "</div>";
    }

    // Question text
    html += '<div class="question-text">' + escapeHTMLJS(q.question) + "</div>";

    // Options
    html += '<div class="options">';
    var opts = q.options || [];
    for (var i = 0; i < opts.length; i++) {
      var o = opts[i];
      var selected = answers[q.id] === o.label;
      var answered = answers[q.id] !== undefined;
      var isCorrect = q.correctAnswer === o.label;
      var cls = "option";
      if (selected) cls += " selected";
      if (answered && isCorrect) cls += " correct";
      if (answered && selected && !isCorrect) cls += " incorrect";

      html += '<button class="' + cls + '" onclick="selectOption(' + index + ",'" + o.label + "')" " + (answered ? "disabled" : "") + ">";
      html += '<span class="option-label">' + o.label + "</span>";
      html += '<span class="option-text">' + escapeHTMLJS(o.text) + "</span>";
      html += "</button>";
    }
    html += "</div>";

    // Feedback area (shown after answering)
    if (answers[q.id] !== undefined) {
      var correct = answers[q.id] === q.correctAnswer;
      html += '<div class="feedback ' + (correct ? "feedback-correct" : "feedback-incorrect") + '">';
      html += correct ? ui.correct : ui.incorrect;
      if (!correct && q.correctAnswer) {
        html += " " + ui.correctAnswerIs + " " + q.correctAnswer;
      }
      if (q.explanation) {
        html += '<div class="explanation">' + escapeHTMLJS(q.explanation) + "</div>";
      }
      html += "</div>";

      // Transcript reveal AFTER answering (DLPT-style: no toggle, auto-reveal)
      if (q.type === "listening" && q.passage) {
        var pLang = q.passageLanguage === "russian" ? "ru" : "en";
        html += '<div class="transcript" lang="' + pLang + '">';
        html += '<div class="transcript-label">' + ui.transcript + "</div>";
        html += "<p>" + escapeHTMLJS(q.passage) + "</p>";
        html += "</div>";
      }
    }

    // Navigation
    html += '<div class="nav-buttons">';
    if (index > 0) {
      html += '<button class="btn btn-secondary" onclick="goTo(' + (index - 1) + ')">' + ui.previous + "</button>";
    }
    if (index < questions.length - 1) {
      html += '<button class="btn btn-primary" onclick="goTo(' + (index + 1) + ')">' + ui.next + "</button>";
    } else {
      var allAnswered = Object.keys(answers).length === questions.length;
      html += '<button class="btn btn-primary" onclick="showResults()" ' + (allAnswered ? "" : "disabled") + ">" + ui.finish + "</button>";
    }
    html += "</div>";

    html += "</div>";

    container.innerHTML = html;
    currentQuestion = index;
  }

  function escapeHTMLJS(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  window.selectOption = function(qIndex, label) {
    var q = questions[qIndex];
    answers[q.id] = label;
    renderQuestion(qIndex);
    updateProgress();
  };

  window.goTo = function(index) {
    renderQuestion(index);
  };

  window.playAudio = function(qId) {
    var audio = document.getElementById("audio-" + qId);
    if (!audio) return;
    var remaining = playCounters[qId];
    if (remaining <= 0) return;

    audio.currentTime = 0;
    audio.play();
    playCounters[qId] = remaining - 1;

    var countEl = document.getElementById("playCount-" + qId);
    if (countEl) countEl.textContent = ui.playsRemaining + ": " + playCounters[qId];

    if (playCounters[qId] <= 0) {
      var btn = document.getElementById("playBtn-" + qId);
      if (btn) btn.disabled = true;
    }
  };

  function updateProgress() {
    var answered = Object.keys(answers).length;
    var total = questions.length;
    var pct = total > 0 ? (answered / total) * 100 : 0;
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("progressText").textContent = answered + " / " + total;
  }

  window.showResults = function() {
    var correct = 0;
    for (var i = 0; i < questions.length; i++) {
      if (answers[questions[i].id] === questions[i].correctAnswer) correct++;
    }
    var total = questions.length;
    var pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    document.getElementById("quizContainer").classList.add("hidden");
    var panel = document.getElementById("resultsPanel");
    panel.classList.remove("hidden");

    document.getElementById("scoreDisplay").textContent = correct + " / " + total + " (" + pct + "%)";
    document.getElementById("scoreFill").style.width = pct + "%";

    // Review section
    var reviewHTML = "";
    for (var j = 0; j < questions.length; j++) {
      var q = questions[j];
      var userAnswer = answers[q.id];
      var isCorrect = userAnswer === q.correctAnswer;
      reviewHTML += '<div class="review-item ' + (isCorrect ? "review-correct" : "review-incorrect") + '">';
      reviewHTML += "<strong>" + ui.question + " " + (j + 1) + ":</strong> ";
      reviewHTML += escapeHTMLJS(q.question);
      reviewHTML += '<br>' + ui.yourAnswer + ": " + (userAnswer || "—");
      if (!isCorrect) {
        reviewHTML += " | " + ui.correctAnswerIs + " " + (q.correctAnswer || "—");
      }
      reviewHTML += "</div>";
    }
    document.getElementById("reviewContainer").innerHTML = reviewHTML;
  };

  window.resetQuiz = function() {
    answers = {};
    playCounters = {};
    document.getElementById("resultsPanel").classList.add("hidden");
    document.getElementById("quizContainer").classList.remove("hidden");
    renderQuestion(0);
    updateProgress();
  };

  init();
})();
</script>
</body>
</html>`;
}

/**
 * UI string translations.
 */
function getUIStrings(language) {
  if (language === 'russian') {
    return {
      question: 'Вопрос',
      reading: 'Чтение',
      listening: 'Аудирование',
      play: 'Воспроизвести',
      playsRemaining: 'Осталось воспроизведений',
      passageRu: 'Текст для чтения',
      passageEn: 'Reading Passage',
      transcript: 'Транскрипт',
      correct: 'Правильно!',
      incorrect: 'Неправильно.',
      correctAnswerIs: 'Правильный ответ:',
      yourAnswer: 'Ваш ответ',
      previous: 'Назад',
      next: 'Далее',
      finish: 'Завершить',
      results: 'Результаты',
      tryAgain: 'Попробовать снова',
    };
  }

  // English / mixed default
  return {
    question: 'Question',
    reading: 'Reading',
    listening: 'Listening',
    play: 'Play Audio',
    playsRemaining: 'Plays remaining',
    passageRu: 'Текст для чтения',
    passageEn: 'Reading Passage',
    transcript: 'Transcript',
    correct: 'Correct!',
    incorrect: 'Incorrect.',
    correctAnswerIs: 'Correct answer:',
    yourAnswer: 'Your answer',
    previous: 'Previous',
    next: 'Next',
    finish: 'Finish',
    results: 'Results',
    tryAgain: 'Try Again',
  };
}

/**
 * CSS styles for the quiz.
 */
function getStyles() {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  min-height: 100vh;
  line-height: 1.6;
}
#app { max-width: 800px; margin: 0 auto; padding: 1.5rem; }
header { text-align: center; margin-bottom: 2rem; }
h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #f1f5f9; }
h2 { font-size: 1.3rem; margin-bottom: 1rem; color: #f1f5f9; }
.hidden { display: none !important; }

/* Progress */
.progress-bar {
  width: 100%; height: 8px; background: #1e293b; border-radius: 4px; overflow: hidden; margin-bottom: 0.5rem;
}
.progress-fill { height: 100%; background: #3b82f6; transition: width 0.3s; border-radius: 4px; }
.progress-text { font-size: 0.875rem; color: #94a3b8; }

/* Question card */
.question-card {
  background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;
  border: 1px solid #334155;
}
.question-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;
}
.question-number { font-weight: 600; color: #94a3b8; font-size: 0.875rem; }
.badge-reading {
  background: #1d4ed8; color: #dbeafe; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;
}
.badge-listening {
  background: #7c3aed; color: #ede9fe; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;
}

/* Audio */
.audio-section {
  display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; padding: 0.75rem;
  background: #0f172a; border-radius: 8px;
}
.btn-audio {
  background: #7c3aed; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 6px;
  cursor: pointer; font-weight: 600; font-size: 0.875rem;
}
.btn-audio:hover:not(:disabled) { background: #6d28d9; }
.btn-audio:disabled { opacity: 0.4; cursor: not-allowed; }
.play-count { font-size: 0.8rem; color: #a78bfa; }

/* Passage */
.passage {
  background: #0f172a; border-left: 3px solid #3b82f6; padding: 1rem; border-radius: 0 8px 8px 0;
  margin-bottom: 1rem;
}
.passage p { white-space: pre-wrap; }
.passage-label { font-size: 0.75rem; color: #3b82f6; font-weight: 600; margin-bottom: 0.5rem; text-transform: uppercase; }

/* Question text */
.question-text { font-size: 1.05rem; font-weight: 500; margin-bottom: 1rem; color: #f1f5f9; }

/* Options */
.options { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.option {
  display: flex; align-items: flex-start; gap: 0.75rem; width: 100%; text-align: left;
  background: #0f172a; border: 2px solid #334155; padding: 0.75rem 1rem; border-radius: 8px;
  cursor: pointer; transition: border-color 0.2s, background 0.2s; color: #e2e8f0;
  font-size: 0.95rem;
}
.option:hover:not(:disabled) { border-color: #3b82f6; background: #1a2744; }
.option:disabled { cursor: default; }
.option.selected { border-color: #3b82f6; background: #1e3a5f; }
.option.correct { border-color: #22c55e; background: #14532d; }
.option.incorrect { border-color: #ef4444; background: #450a0a; }
.option-label {
  min-width: 1.5rem; height: 1.5rem; display: flex; align-items: center; justify-content: center;
  background: #334155; border-radius: 4px; font-weight: 700; font-size: 0.8rem;
}
.option-text { flex: 1; }

/* Feedback */
.feedback { padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; font-weight: 500; }
.feedback-correct { background: #14532d; color: #86efac; border: 1px solid #22c55e; }
.feedback-incorrect { background: #450a0a; color: #fca5a5; border: 1px solid #ef4444; }
.explanation { margin-top: 0.5rem; font-weight: 400; font-size: 0.9rem; opacity: 0.9; }

/* Transcript (appears after answering) */
.transcript {
  background: #1a1a2e; border-left: 3px solid #a78bfa; padding: 1rem; border-radius: 0 8px 8px 0;
  margin-bottom: 1rem;
}
.transcript p { white-space: pre-wrap; }
.transcript-label { font-size: 0.75rem; color: #a78bfa; font-weight: 600; margin-bottom: 0.5rem; text-transform: uppercase; }

/* Navigation */
.nav-buttons { display: flex; justify-content: space-between; gap: 1rem; }
.btn {
  padding: 0.6rem 1.5rem; border: none; border-radius: 8px; font-weight: 600;
  cursor: pointer; font-size: 0.95rem; transition: background 0.2s;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #2563eb; }
.btn-secondary { background: #334155; color: #e2e8f0; }
.btn-secondary:hover:not(:disabled) { background: #475569; }

/* Results */
.results { background: #1e293b; border-radius: 12px; padding: 2rem; text-align: center; border: 1px solid #334155; }
.score { font-size: 2rem; font-weight: 700; color: #f1f5f9; margin: 1rem 0; }
.score-bar { width: 100%; height: 12px; background: #0f172a; border-radius: 6px; overflow: hidden; margin-bottom: 1.5rem; }
.score-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #eab308, #22c55e); transition: width 0.5s; border-radius: 6px; }
.review-item { text-align: left; padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; font-size: 0.9rem; }
.review-correct { background: #14532d; border: 1px solid #22c55e; }
.review-incorrect { background: #450a0a; border: 1px solid #ef4444; }

/* Mobile */
@media (max-width: 600px) {
  #app { padding: 1rem; }
  .question-card { padding: 1rem; }
  .audio-section { flex-direction: column; align-items: flex-start; }
  h1 { font-size: 1.2rem; }
}
`;
}

/**
 * Escape HTML entities.
 */
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Save generated HTML to a file and return the path.
 */
function saveQuizHTML(html, filename) {
  const exportsDir = path.join(__dirname, '../../exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const filePath = path.join(exportsDir, filename);
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
}

module.exports = {
  generateQuizHTML,
  saveQuizHTML,
  escapeHTML,
};
