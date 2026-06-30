let questions = [];
let examQuestions = [];
let areaGroups = [];
let currentAreaIndex = 0;
let answers = [];
let timerInterval;
let remainingTime = 90 * 60;

const AREA_ORDER = [
  'Biología',
  'Ciencias de la Salud',
  'Pensamiento Matemático',
  'Comprensión lectora',
  'Redacción indirecta'
];

async function loadQuestions() {
  const response = await fetch('data/questions.json');
  if (!response.ok) {
    throw new Error('No se pudo cargar data/questions.json');
  }
  questions = await response.json();
}

function getAreaIndex(area) {
  const index = AREA_ORDER.indexOf(area);
  return index === -1 ? AREA_ORDER.length : index;
}

function buildOrderedExam(allQuestions) {
  return allQuestions
    .slice()
    .sort((a, b) => {
      const areaDifference = getAreaIndex(a.area) - getAreaIndex(b.area);
      if (areaDifference !== 0) return areaDifference;
      const topicDifference = String(a.topic).localeCompare(String(b.topic), 'es');
      if (topicDifference !== 0) return topicDifference;
      return Number(a.id) - Number(b.id);
    });
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

function startExam() {
  examQuestions = buildOrderedExam(questions);
  areaGroups = buildAreaGroups(examQuestions);
  currentAreaIndex = 0;
  answers = [];
  remainingTime = 90 * 60;

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

function renderQuestionCard(question, index) {
  const options = Object.entries(question.options).map(([key, text]) => `
    <label class="option">
      <input type="radio" name="q-${question.id}" value="${key}">
      <span><strong>${key})</strong> ${text}</span>
    </label>
  `).join('');

  return `
    <article class="question-card">
      <div class="question-card-header">
        <span>Pregunta ${index + 1}</span>
        <small>${question.topic} · ${question.difficulty}</small>
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
  const totalAnsweredBeforeArea = answers.length;
  const questionStart = totalAnsweredBeforeArea + 1;
  const questionEnd = totalAnsweredBeforeArea + group.questions.length;

  document.getElementById('progress').textContent = `Área ${currentAreaIndex + 1} de ${areaGroups.length} · Preguntas ${questionStart}-${questionEnd}`;

  const container = document.getElementById('questionContainer');
  container.innerHTML = `
    <div class="area-banner">
      <div>
        <span class="topic-label">Área actual</span>
        <h2>${group.area}</h2>
        <p>Responde todas las preguntas de esta área en una sola pantalla.</p>
      </div>
      <strong id="areaAnsweredCounter">0 de ${group.questions.length} respondidas</strong>
    </div>
    <div class="area-question-list">
      ${group.questions.map((question, index) => renderQuestionCard(question, index)).join('')}
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

function finishExam() {
  clearInterval(timerInterval);

  const answeredIds = new Set(answers.map(answer => answer.question.id));
  examQuestions.forEach(question => {
    if (!answeredIds.has(question.id)) {
      answers.push({ question, selected: null, correct: false });
    }
  });

  const correctCount = answers.filter(answer => answer.correct).length;
  const percentage = Math.round((correctCount / examQuestions.length) * 100);
  const stats = {};

  answers.forEach(answer => {
    const area = answer.question.area;
    if (!stats[area]) stats[area] = { total: 0, correct: 0 };
    stats[area].total++;
    if (answer.correct) stats[area].correct++;
  });

  document.getElementById('exam').classList.add('hidden');
  document.getElementById('results').classList.remove('hidden');
  document.getElementById('score').innerHTML = `<strong>Aciertos:</strong> ${correctCount} de ${examQuestions.length} (${percentage}%)`;

  const areaResults = document.getElementById('areaResults');
  areaResults.innerHTML = '<h3>Resultado por área</h3>';

  Object.entries(stats).forEach(([area, result]) => {
    const div = document.createElement('div');
    div.className = 'area-result';
    div.textContent = `${area}: ${result.correct} de ${result.total}`;
    areaResults.appendChild(div);
  });

  const review = document.getElementById('review');
  review.innerHTML = '<h3>Revisión de respuestas</h3>';

  answers.forEach((answer, index) => {
    const question = answer.question;
    const selectedText = answer.selected ? `${answer.selected}) ${question.options[answer.selected]}` : 'Sin responder';
    const correctText = `${question.correct_answer}) ${question.options[question.correct_answer]}`;
    const item = document.createElement('div');

    item.className = 'review-item';
    item.innerHTML = `
      <p><strong>${index + 1}. ${question.question}</strong></p>
      <p><small>${question.area} · ${question.topic}</small></p>
      <p>Tu respuesta: <span class="${answer.correct ? 'correct' : 'incorrect'}">${selectedText}</span></p>
      <p>Respuesta correcta: <span class="correct">${correctText}</span></p>
      <p><strong>Explicación:</strong> ${question.explanation}</p>
    `;
    review.appendChild(item);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadQuestions();
  } catch (error) {
    alert('Error: no se cargaron las preguntas. Revisa que exista data/questions.json.');
    console.error(error);
    return;
  }

  document.getElementById('startButton').addEventListener('click', startExam);
  document.getElementById('nextButton').addEventListener('click', nextQuestion);
  document.getElementById('restartButton').addEventListener('click', () => {
    document.getElementById('results').classList.add('hidden');
    document.getElementById('intro').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});