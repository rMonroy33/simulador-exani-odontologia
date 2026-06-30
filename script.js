// Lógica del simulador de examen EXANI‑II

let questions = [];
let examQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let areaStats = {};
let timerInterval;
// Tiempo límite en segundos (por ejemplo 90 minutos = 5400 segundos)
const timeLimit = 90 * 60;
let remainingTime = timeLimit;

// Carga las preguntas desde el archivo JSON ubicado en data/questions.json
async function loadQuestions() {
  try {
    const res = await fetch('data/questions.json');
    if (!res.ok) {
      throw new Error('No se pudo cargar el banco de preguntas');
    }
    questions = await res.json();
  } catch (error) {
    console.error(error);
    alert('Error al cargar las preguntas. Verifique la consola para más detalles.');
  }
}

// Mezcla las preguntas para obtener un orden aleatorio
function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Inicia un nuevo examen con 50 preguntas aleatorias
function startExam() {
  if (!questions || questions.length === 0) {
    alert('No hay preguntas disponibles.');
    return;
  }
  examQuestions = shuffle(questions).slice(0, 50);
  currentIndex = 0;
  correctCount = 0;
  areaStats = {};
  examQuestions.forEach((q) => {
    if (!areaStats[q.area]) {
      areaStats[q.area] = { total: 0, correct: 0 };
    }
    areaStats[q.area].total++;
  });
  // Reinicia temporizador
  remainingTime = timeLimit;
  updateTimer();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    remainingTime--;
    updateTimer();
    if (remainingTime <= 0) {
      finishExam();
    }
  }, 1000);
  showQuestion();
}

// Actualiza el texto del temporizador en pantalla
function updateTimer() {
  const timerEl = document.getElementById('timer');
  const minutes = Math.floor(remainingTime / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (remainingTime % 60)
    .toString()
    .padStart(2, '0');
  timerEl.textContent = `Tiempo restante: ${minutes}:${seconds}`;
}

// Muestra la pregunta actual y sus opciones
function showQuestion() {
  const question = examQuestions[currentIndex];
  const progressEl = document.getElementById('progress');
  progressEl.textContent = `Pregunta ${currentIndex + 1} de ${examQuestions.length}`;
  const container = document.getElementById('questionContainer');
  container.innerHTML = '';
  const qEl = document.createElement('div');
  qEl.className = 'question-text';
  qEl.textContent = question.question;
  container.appendChild(qEl);
  // Crear opciones como botones de radio
  Object.entries(question.options).forEach(([key, text]) => {
    const label = document.createElement('label');
    label.className = 'option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'option';
    input.value = key;
    label.appendChild(input);
    const span = document.createElement('span');
    span.textContent = ` ${key}) ${text}`;
    label.appendChild(span);
    container.appendChild(label);
  });
  // Oculta el botón siguiente hasta que se seleccione una opción
  const nextBtn = document.getElementById('nextButton');
  nextBtn.classList.add('hidden');
  const radios = container.querySelectorAll('input[name="option"]');
  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      nextBtn.classList.remove('hidden');
    });
  });
}

// Procesa la respuesta seleccionada y avanza a la siguiente pregunta o finaliza el examen
function nextQuestion() {
  const selected = document.querySelector('input[name="option"]:checked');
  if (!selected) {
    return;
  }
  const question = examQuestions[currentIndex];
  if (selected.value === question.correct_answer) {
    correctCount++;
    areaStats[question.area].correct++;
  }
  currentIndex++;
  if (currentIndex >= examQuestions.length) {
    finishExam();
  } else {
    showQuestion();
  }
}

// Finaliza el examen: detiene el temporizador y muestra los resultados
function finishExam() {
  clearInterval(timerInterval);
  document.getElementById('exam').classList.add('hidden');
  const resultsSection = document.getElementById('results');
  resultsSection.classList.remove('hidden');
  const scoreEl = document.getElementById('score');
  scoreEl.textContent = `Aciertos: ${correctCount} de ${examQuestions.length}`;
  const areaResults = document.getElementById('areaResults');
  areaResults.innerHTML = '';
  Object.entries(areaStats).forEach(([area, stats]) => {
    const p = document.createElement('p');
    p.className = 'area-result';
    p.textContent = `${area}: ${stats.correct} / ${stats.total}`;
    areaResults.appendChild(p);
  });
}

// Configura eventos al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  loadQuestions();
  const startBtn = document.getElementById('startButton');
  startBtn.addEventListener('click', () => {
    document.getElementById('intro').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('exam').classList.remove('hidden');
    startExam();
  });
  const nextBtn = document.getElementById('nextButton');
  nextBtn.addEventListener('click', nextQuestion);
  const restartBtn = document.getElementById('restartButton');
  restartBtn.addEventListener('click', () => {
    // Restablece a vista inicial
    currentIndex = 0;
    correctCount = 0;
    clearInterval(timerInterval);
    document.getElementById('results').classList.add('hidden');
    document.getElementById('exam').classList.add('hidden');
    document.getElementById('intro').classList.remove('hidden');
  });
});