let questions = [];
let examQuestions = [];
let areaGroups = [];
let currentAreaIndex = 0;
let answers = [];
let timerInterval;
let remainingTime = 90 * 60;
let currentMode = 'quick';

const QUESTION_FILES = [
  { path: 'data/questions.json', required: true },
  { path: 'data/questions_extra.json', required: false },
  { path: 'data/questions_enhanced.json', required: false }
];

const AREA_ORDER = [
  'Biología',
  'Ciencias de la Salud',
  'Pensamiento Matemático',
  'Comprensión lectora',
  'Redacción indirecta',
  'Inglés diagnóstico'
];

const DIAGNOSTIC_AREAS = new Set(['Inglés diagnóstico']);
const STORAGE_ERRORS_KEY = 'exaniOdontoIncorrectIds';

async function fetchQuestionFile(path, required = true) {
  const response = await fetch(path);
  if (!response.ok) {
    if (required) throw new Error(`No se pudo cargar ${path}`);
    return [];
  }
  return response.json();
}

async function loadQuestions() {
  const loadedBanks = await Promise.all(
    QUESTION_FILES.map(file => fetchQuestionFile(file.path, file.required))
  );

  const questionMap = new Map();
  loadedBanks.flat().forEach(question => {
    if (question && question.id && question.question && question.options) {
      questionMap.set(String(question.id), question);
    }
  });

  questions = Array.from(questionMap.values());
  updateBankStats();
}

function updateBankStats() {
  const stats = questions.reduce((acc, question) => {
    acc[question.area] = (acc[question.area] || 0) + 1;
    return acc;
  }, {});

  const scoredCount = questions.filter(question => !DIAGNOSTIC_AREAS.has(question.area)).length;
  const diagnosticCount = questions.length - scoredCount;
  const detail = Object.entries(stats)
    .sort(([a], [b]) => getAreaIndex(a) - getAreaIndex(b))
    .map(([area, total]) => `<span>${area}: <strong>${total}</strong></span>`)
    .join('');

  const bankStats = document.getElementById('bankStats');
  if (bankStats) {
    bankStats.innerHTML = `
      <strong>${questions.length}</strong> preguntas cargadas ·
      <strong>${scoredCount}</strong> calificables ·
      <strong>${diagnosticCount}</strong> diagnósticas
      <div class="bank-detail">${detail}</div>
    `;
  }
}

function getAreaIndex(area) {
  const index = AREA_ORDER.indexOf(area);
  return index === -1 ? AREA_ORDER.length : index;
}

function sortQuestions(allQuestions) {
  return allQuestions.slice().sort((a, b) => {
    const areaDifference = getAreaIndex(a.area) - getAreaIndex(b.area);
    if (areaDifference !== 0) return areaDifference;
    const topicDifference = String(a.topic || '').localeCompare(String(b.topic || ''), 'es');
    if (topicDifference !== 0) return topicDifference;
    return Number(a.id) - Number(b.id);
  });
}

function getSavedErrorIds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_ERRORS_KEY) || '[]').map(String);
  } catch {
    return [];
  }
}

function saveErrorIds(ids) {
  localStorage.setItem(STORAGE_ERRORS_KEY, JSON.stringify(Array.from(new Set(ids.map(String)))));
}

function balancedQuickSelection(allQuestions, limit = 50) {
  const scored = sortQuestions(allQuestions.filter(question => !DIAGNOSTIC_AREAS.has(question.area)));
  const byArea = AREA_ORDER
    .filter(area => !DIAGNOSTIC_AREAS.has(area))
    .map(area => scored.filter(question => question.area === area))
    .filter(group => group.length > 0);

  const selected = [];
  let cursor = 0;
  while (selected.length < limit && byArea.some(group => cursor < group.length)) {
    byArea.forEach(group => {
      if (selected.length < limit && cursor < group.length) selected.push(group[cursor]);
    });
    cursor++;
  }
  return sortQuestions(selected);
}

function selectQuestionsForMode(mode) {
  if (mode === 'full') return sortQuestions(questions);

  if (mode === 'errors') {
    const ids = new Set(getSavedErrorIds());
    return sortQuestions(questions.filter(question => ids.has(String(question.id))));
  }

  return balancedQuickSelection(questions, 50);
}

function buildAreaGroups(orderedQuestions) {
  const groups = [];
  orderedQuestions.forEach(question => {
    let group = groups.find(item => item.area === question.area);
    if (!group) {
      group = { area: question.area, questions: [] };
      groups.push(group);
    }
    group.questions.push(question);
  });
  return groups;
}

function updateTimer() {
  const minutes = Math.floor(remainingTime / 60).toString().padStart(2, '0');
  const seconds = (remainingTime % 60).toString().padStart(2, '0');
  document.getElementById('timer').textContent = `Tiempo restante: ${minutes}:${seconds}`;
}

function startExam(mode = 'quick') {
  currentMode = mode;
  examQuestions = selectQuestionsForMode(mode);

  if (examQuestions.length === 0) {
    alert('No hay preguntas disponibles para este modo. Primero realiza un simulacro y falla algunas preguntas para usar Repasar errores.');
    return;
  }

  areaGroups = buildAreaGroups(examQuestions);
  currentAreaIndex = 0;
  answers = [];
  remainingTime = mode === 'full' ? 270 * 60 : 90 * 60;

  document.getElementById('intro').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('exam').classList.remove('hidden');

  updateTimer();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    remainingTime--;
    updateTimer();
    if (remainingTime <= 0) finishExam();
  }, 1000);

  showCurrentArea();
}

function getAnsweredCountForArea(group) {
  return group.questions.filter(question => document.querySelector(`input[name="q-${question.id}"]:checked`)).length;
}

function updateAreaButtonState() {
  const group = areaGroups[currentAreaIndex];
  const answered = getAnsweredCountForArea(group);
  const nextButton = document.getElementById('nextButton');
  const isLastArea = currentAreaIndex === areaGroups.length - 1;

  document.getElementById('areaAnsweredCounter').textContent = `${answered} de ${group.questions.length} respondidas`;
  nextButton.textContent = isLastArea ? 'Finalizar simulacro' : 'Guardar área y continuar';
  nextButton.classList.remove('hidden');
}

function renderIllustration(question) {
  if (!question.illustration) return '';
  return `<div class="illustration-box">${question.illustration}</div>`;
}

function renderPassage(question) {
  if (!question.passage) return '';
  return `<div class="passage"><strong>Lectura</strong><p>${question.passage}</p></div>`;
}

function renderQuestionCard(question, index, globalNumber) {
  const options = Object.entries(question.options).map(([key, text]) => `
    <label class="option">
      <input type="radio" name="q-${question.id}" value="${key}">
      <span><strong>${key})</strong> ${text}</span>
    </label>
  `).join('');

  const diagnosticLabel = DIAGNOSTIC_AREAS.has(question.area) ? '<span class="diagnostic-pill">Diagnóstico</span>' : '';

  return `
    <article class="question-card">
      <div class="question-card-header">
        <span>Pregunta ${globalNumber}</span>
        <small>${question.topic || 'Tema general'} · ${question.difficulty || 'media'} ${diagnosticLabel}</small>
      </div>
      ${renderPassage(question)}
      ${renderIllustration(question)}
      <div class="question-text">${question.question}</div>
      <div class="answers-panel">${options}</div>
    </article>
  `;
}

function showCurrentArea() {
  const group = areaGroups[currentAreaIndex];
  const answeredBeforeArea = answers.length;
  const questionStart = answeredBeforeArea + 1;
  const questionEnd = answeredBeforeArea + group.questions.length;
  const isDiagnostic = DIAGNOSTIC_AREAS.has(group.area);

  document.getElementById('progress').textContent = `Área ${currentAreaIndex + 1} de ${areaGroups.length} · Preguntas ${questionStart}-${questionEnd}`;

  const container = document.getElementById('questionContainer');
  container.innerHTML = `
    <div class="area-banner ${isDiagnostic ? 'diagnostic-area' : ''}">
      <div>
        <span class="topic-label">${isDiagnostic ? 'Área diagnóstica' : 'Área calificable'}</span>
        <h2>${group.area}</h2>
        <p>Responde todas las preguntas de esta área en una sola pantalla.</p>
      </div>
      <strong id="areaAnsweredCounter">0 de ${group.questions.length} respondidas</strong>
    </div>
    <div class="area-question-list">
      ${group.questions.map((question, index) => renderQuestionCard(question, index, questionStart + index)).join('')}
    </div>
  `;

  container.querySelectorAll('input[type="radio"]').forEach(input => {
    input.addEventListener('change', updateAreaButtonState);
  });

  updateAreaButtonState();
}

function saveCurrentAreaAnswers() {
  const group = areaGroups[currentAreaIndex];
  const unanswered = [];
  const areaAnswers = [];

  group.questions.forEach(question => {
    const selected = document.querySelector(`input[name="q-${question.id}"]:checked`);
    if (!selected) {
      unanswered.push(question.id);
      return;
    }
    areaAnswers.push({
      question,
      selected: selected.value,
      correct: selected.value === question.correct_answer
    });
  });

  if (unanswered.length > 0) {
    alert(`Te faltan ${unanswered.length} pregunta(s) de esta área.`);
    return false;
  }

  answers.push(...areaAnswers);
  return true;
}

function nextQuestion() {
  const saved = saveCurrentAreaAnswers();
  if (!saved) return;

  currentAreaIndex++;
  if (currentAreaIndex >= areaGroups.length) {
    finishExam();
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showCurrentArea();
  }
}

function buildStats(filteredAnswers, keyGetter) {
  const stats = {};
  filteredAnswers.forEach(answer => {
    const key = keyGetter(answer);
    if (!stats[key]) stats[key] = { total: 0, correct: 0 };
    stats[key].total++;
    if (answer.correct) stats[key].correct++;
  });
  return stats;
}

function percent(correct, total) {
  return total ? Math.round((correct / total) * 100) : 0;
}

function finishExam() {
  clearInterval(timerInterval);

  const answeredIds = new Set(answers.map(answer => String(answer.question.id)));
  examQuestions.forEach(question => {
    if (!answeredIds.has(String(question.id))) {
      answers.push({ question, selected: null, correct: false });
    }
  });

  const scoredAnswers = answers.filter(answer => !DIAGNOSTIC_AREAS.has(answer.question.area));
  const diagnosticAnswers = answers.filter(answer => DIAGNOSTIC_AREAS.has(answer.question.area));
  const correctCount = scoredAnswers.filter(answer => answer.correct).length;
  const scorePercent = percent(correctCount, scoredAnswers.length);

  const incorrectIds = answers.filter(answer => !answer.correct).map(answer => answer.question.id);
  saveErrorIds(incorrectIds);

  document.getElementById('exam').classList.add('hidden');
  document.getElementById('results').classList.remove('hidden');
  document.getElementById('score').innerHTML = `<strong>Aciertos calificables:</strong> ${correctCount} de ${scoredAnswers.length} (${scorePercent}%)`;

  const summaryCards = document.getElementById('summaryCards');
  summaryCards.innerHTML = `
    <div class="summary-card"><span>Puntaje</span><strong>${scorePercent}%</strong></div>
    <div class="summary-card"><span>Preguntas</span><strong>${answers.length}</strong></div>
    <div class="summary-card"><span>Diagnóstico inglés</span><strong>${diagnosticAnswers.filter(a => a.correct).length}/${diagnosticAnswers.length}</strong></div>
    <div class="summary-card"><span>Para repasar</span><strong>${incorrectIds.length}</strong></div>
  `;

  renderAreaResults(scoredAnswers, diagnosticAnswers);
  renderWeakTopics(scoredAnswers);
  renderReview(answers);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAreaResults(scoredAnswers, diagnosticAnswers) {
  const areaResults = document.getElementById('areaResults');
  const areaStats = buildStats(scoredAnswers, answer => answer.question.area);
  areaResults.innerHTML = '<h3>Resultado por área</h3>';

  Object.entries(areaStats).forEach(([area, result]) => {
    const div = document.createElement('div');
    div.className = 'area-result';
    div.innerHTML = `<strong>${area}</strong><span>${result.correct} de ${result.total} · ${percent(result.correct, result.total)}%</span>`;
    areaResults.appendChild(div);
  });

  if (diagnosticAnswers.length) {
    const correct = diagnosticAnswers.filter(answer => answer.correct).length;
    const div = document.createElement('div');
    div.className = 'area-result diagnostic-result';
    div.innerHTML = `<strong>Inglés diagnóstico</strong><span>${correct} de ${diagnosticAnswers.length} · no cuenta para puntaje</span>`;
    areaResults.appendChild(div);
  }
}

function renderWeakTopics(scoredAnswers) {
  const weakTopics = document.getElementById('weakTopics');
  const topicStats = buildStats(scoredAnswers, answer => `${answer.question.area} · ${answer.question.topic || 'Tema general'}`);
  const weak = Object.entries(topicStats)
    .map(([topic, result]) => ({ topic, ...result, pct: percent(result.correct, result.total) }))
    .filter(item => item.total >= 1 && item.pct < 70)
    .sort((a, b) => a.pct - b.pct);

  weakTopics.innerHTML = '<h3>Temas débiles sugeridos</h3>';
  if (!weak.length) {
    weakTopics.innerHTML += '<p class="ok-message">Buen resultado general. Mantén práctica con simulacros completos.</p>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'weak-topic-list';
  weak.slice(0, 12).forEach(item => {
    const div = document.createElement('div');
    div.className = 'weak-topic';
    div.innerHTML = `<strong>${item.topic}</strong><span>${item.correct}/${item.total} · ${item.pct}%</span>`;
    list.appendChild(div);
  });
  weakTopics.appendChild(list);
}

function renderReview(reviewAnswers) {
  const review = document.getElementById('review');
  review.innerHTML = '<h3>Revisión de respuestas</h3>';

  reviewAnswers.forEach((answer, index) => {
    const question = answer.question;
    const selectedText = answer.selected ? `${answer.selected}) ${question.options[answer.selected]}` : 'Sin responder';
    const correctText = `${question.correct_answer}) ${question.options[question.correct_answer]}`;
    const item = document.createElement('div');

    item.className = `review-item ${answer.correct ? 'review-ok' : 'review-bad'}`;
    item.innerHTML = `
      <p><strong>${index + 1}. ${question.question}</strong></p>
      <p><small>${question.area} · ${question.topic || 'Tema general'}</small></p>
      <p>Tu respuesta: <span class="${answer.correct ? 'correct' : 'incorrect'}">${selectedText}</span></p>
      <p>Respuesta correcta: <span class="correct">${correctText}</span></p>
      <p><strong>Explicación:</strong> ${question.explanation || 'Revisa el tema correspondiente.'}</p>
    `;
    review.appendChild(item);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadQuestions();
  } catch (error) {
    alert('Error: no se cargaron las preguntas. Revisa que existan los archivos JSON en /data.');
    console.error(error);
    return;
  }

  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => startExam(button.dataset.mode));
  });

  document.getElementById('nextButton').addEventListener('click', nextQuestion);
  document.getElementById('restartButton').addEventListener('click', () => {
    document.getElementById('results').classList.add('hidden');
    document.getElementById('intro').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('reviewErrorsButton').addEventListener('click', () => {
    document.getElementById('results').classList.add('hidden');
    startExam('errors');
  });
});
