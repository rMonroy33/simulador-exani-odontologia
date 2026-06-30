let questions = [];
let examQuestions = [];
let currentIndex = 0;
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
    })
    .slice(0, 50);
}

function updateTimer() {
  const minutes = Math.floor(remainingTime / 60).toString().padStart(2, '0');
  const seconds = (remainingTime % 60).toString().padStart(2, '0');
  document.getElementById('timer').textContent = `Tiempo restante: ${minutes}:${seconds}`;
}

function startExam() {
  examQuestions = buildOrderedExam(questions);
  currentIndex = 0;
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

  showQuestion();
}

function getTopicProgress(question) {
  const sameTopicQuestions = examQuestions.filter(q => q.area === question.area && q.topic === question.topic);
  const answeredSameTopic = examQuestions
    .slice(0, currentIndex + 1)
    .filter(q => q.area === question.area && q.topic === question.topic);

  return `${answeredSameTopic.length} de ${sameTopicQuestions.length}`;
}

function showQuestion() {
  const question = examQuestions[currentIndex];
  const nextQuestion = examQuestions[currentIndex + 1];
  const isLastQuestion = currentIndex === examQuestions.length - 1;

  document.getElementById('progress').textContent = `Pregunta ${currentIndex + 1} de ${examQuestions.length}`;

  const container = document.getElementById('questionContainer');
  container.innerHTML = `
    <div class="topic-banner">
      <span class="topic-label">Tema actual</span>
      <strong>${question.area} · ${question.topic}</strong>
      <span>${getTopicProgress(question)}</span>
    </div>
    <div class="question-layout">
      <div class="question-panel">
        <div class="meta">Dificultad: ${question.difficulty}</div>
        <div class="question-text">${question.question}</div>
      </div>
      <div class="answers-panel" id="answersPanel"></div>
    </div>
  `;

  const answersPanel = document.getElementById('answersPanel');
  Object.entries(question.options).forEach(([key, text]) => {
    const label = document.createElement('label');
    label.className = 'option';
    label.innerHTML = `<input type="radio" name="option" value="${key}"> <strong>${key})</strong> ${text}`;
    answersPanel.appendChild(label);
  });

  const nextButton = document.getElementById('nextButton');
  nextButton.textContent = isLastQuestion ? 'Finalizar simulacro' : 'Siguiente';
  nextButton.classList.add('hidden');

  container.querySelectorAll('input[name="option"]').forEach(radio => {
    radio.addEventListener('change', () => nextButton.classList.remove('hidden'));
  });

  if (nextQuestion && (nextQuestion.area !== question.area || nextQuestion.topic !== question.topic)) {
    const notice = document.createElement('div');
    notice.className = 'next-topic-notice';
    notice.textContent = `Después de esta pregunta inicia: ${nextQuestion.area} · ${nextQuestion.topic}`;
    container.appendChild(notice);
  }
}

function nextQuestion() {
  const selected = document.querySelector('input[name="option"]:checked');
  if (!selected) return;

  const question = examQuestions[currentIndex];
  answers.push({
    question,
    selected: selected.value,
    correct: selected.value === question.correct_answer
  });

  currentIndex++;
  if (currentIndex >= examQuestions.length) {
    finishExam();
  } else {
    showQuestion();
  }
}

function finishExam() {
  clearInterval(timerInterval);

  while (answers.length < examQuestions.length) {
    const question = examQuestions[answers.length];
    answers.push({ question, selected: null, correct: false });
  }

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
  });
});