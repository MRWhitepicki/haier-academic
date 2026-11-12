/**
 * Haier Academic — Основная логика приложения
 */

(function () {
  'use strict';

  // ===== STATE =====
  const STORAGE_KEY = 'haier_academic_v1';

  let state = {
    userName: 'Студент',
    xp: 0,
    level: 1,
    completedLessons: {},
    examHistory: [],
    weakTopics: {},
    achievements: {},
    settings: {
      examQuestionCount: 10
    },
    viewedTerms: {},
    currentSection: 'dashboard',
    currentLessonId: null,
    currentExam: null
  };

  // ===== UTILS =====
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state = { ...state, ...saved };
      }
    } catch (e) {
      console.warn('Failed to load state', e);
    }
  }

  function saveState() {
    try {
      const toSave = {
        userName: state.userName,
        xp: state.xp,
        level: state.level,
        completedLessons: state.completedLessons,
        examHistory: state.examHistory,
        weakTopics: state.weakTopics,
        achievements: state.achievements,
        settings: state.settings,
        viewedTerms: state.viewedTerms
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save state', e);
    }
  }

  function addXP(amount) {
    state.xp += amount;
    const newLevel = Math.floor(state.xp / 100) + 1;
    if (newLevel > state.level) {
      state.level = newLevel;
    }
    updateSidebarXP();
    saveState();
    checkAchievements();
  }

  function updateSidebarXP() {
    const xpInLevel = state.xp % 100;
    const fill = document.getElementById('sidebar-xp-fill');
    const text = document.getElementById('sidebar-xp-text');
    const levelEl = document.getElementById('sidebar-level');
    const mobileLevel = document.getElementById('mobile-level');
    if (fill) fill.style.width = xpInLevel + '%';
    if (text) text.textContent = state.xp + ' XP';
    if (levelEl) levelEl.textContent = 'Ур. ' + state.level;
    if (mobileLevel) mobileLevel.textContent = 'Ур. ' + state.level;
  }

  function checkAchievements() {
    const completedCount = Object.keys(state.completedLessons).length;
    if (completedCount >= 1) unlockAchievement('ach_first_lesson');
    if (completedCount >= 10) unlockAchievement('ach_10_lessons');

    const matricesLessons = Object.keys(ACADEMY_DATA.lessons).filter(
      id => ACADEMY_DATA.lessons[id].courseId === 'matrices'
    );
    if (matricesLessons.every(id => state.completedLessons[id])) {
      unlockAchievement('ach_all_matrices');
    }

    if (Object.keys(state.viewedTerms).length >= 20) {
      unlockAchievement('ach_encyclopedia');
    }
  }

  function unlockAchievement(id) {
    if (!state.achievements[id]) {
      state.achievements[id] = Date.now();
      saveState();
    }
  }

  function getCourseProgress(courseId) {
    const course = ACADEMY_DATA.courses.find(c => c.id === courseId);
    if (!course) return 0;
    let total = 0;
    let done = 0;
    course.modules.forEach(m => {
      m.lessons.forEach(lid => {
        total++;
        if (state.completedLessons[lid]) done++;
      });
    });
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }

  function getOverallStats() {
    const totalLessons = Object.keys(ACADEMY_DATA.lessons).length;
    const completed = Object.keys(state.completedLessons).length;
    const exams = state.examHistory.length;
    let avgScore = 0;
    if (exams > 0) {
      avgScore = Math.round(
        state.examHistory.reduce((s, e) => s + e.percent, 0) / exams
      );
    }
    return { totalLessons, completed, exams, avgScore };
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== NAVIGATION =====
  function navigate(section, params) {
    state.currentSection = section;
    state.currentLessonId = null;
    state.currentExam = null;

    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.section === section);
    });

    const main = document.getElementById('main-content');
    switch (section) {
      case 'dashboard':
        main.innerHTML = renderDashboard();
        break;
      case 'academy':
        main.innerHTML = renderAcademy();
        bindAcademyEvents();
        break;
      case 'exams':
        main.innerHTML = renderExamCenter();
        bindExamCenterEvents();
        break;
      case 'encyclopedia':
        main.innerHTML = renderEncyclopedia();
        bindEncyclopediaEvents();
        break;
      case 'sales':
        main.innerHTML = renderSales();
        break;
      case 'comparisons':
        main.innerHTML = renderComparisons();
        break;
      case 'database':
        main.innerHTML = renderDatabase();
        break;
      case 'profile':
        main.innerHTML = renderProfile();
        break;
      case 'lesson':
        main.innerHTML = renderLesson(params.lessonId);
        bindLessonEvents(params.lessonId);
        break;
      case 'quiz':
        startQuiz(params);
        break;
      case 'term':
        main.innerHTML = renderTerm(params.termId);
        break;
      default:
        main.innerHTML = renderDashboard();
    }

    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('visible');

    window.scrollTo(0, 0);
  }

  // ===== RENDER: DASHBOARD =====
  function renderDashboard() {
    const stats = getOverallStats();
    const courses = ACADEMY_DATA.courses;

    let progressCards = courses.map(c => {
      const pct = getCourseProgress(c.id);
      const cls = pct < 30 ? 'low' : pct < 70 ? 'mid' : 'high';
      return `
        <div class="progress-card">
          <div class="progress-card-header">
            <span class="progress-card-title">${c.icon} ${c.title}</span>
            <span class="progress-card-percent">${pct}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${cls}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');

    // Recommendations
    let recs = [];
    courses.forEach(c => {
      const pct = getCourseProgress(c.id);
      if (pct < 50) {
        recs.push({
          icon: c.icon,
          title: c.title,
          text: pct === 0 ? 'Ещё не начат' : `Прогресс ${pct}% — стоит продолжить`,
          section: 'academy'
        });
      }
    });

    // Weak topics from exams
    const weakEntries = Object.entries(state.weakTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    weakEntries.forEach(([topic, count]) => {
      recs.push({
        icon: '⚠️',
        title: topic,
        text: `Ошибок в экзаменаx: ${count} — повторите материал`,
        section: 'academy'
      });
    });

    if (recs.length === 0) {
      recs.push({
        icon: '✨',
        title: 'Отличный прогресс',
        text: 'Продолжайте обучение или попробуйте экзамен уровня выше',
        section: 'exams'
      });
    }

    const recHtml = recs.slice(0, 5).map(r => `
      <div class="rec-item" data-goto="${r.section}">
        <span class="rec-icon">${r.icon}</span>
        <div class="rec-text">
          ${escapeHtml(r.title)}
          <small>${escapeHtml(r.text)}</small>
        </div>
      </div>
    `).join('');

    // Recent exams
    let recentExams = '';
    if (state.examHistory.length > 0) {
      recentExams = `
        <div class="section-title mt-3">Последние экзамены</div>
        <div class="rec-list">
          ${state.examHistory.slice(-5).reverse().map(e => `
            <div class="rec-item">
              <span class="rec-icon">${e.percent >= 80 ? '✅' : e.percent >= 60 ? '🟨' : '❌'}</span>
              <div class="rec-text">
                ${escapeHtml(e.level)} · ${escapeHtml(e.category || 'Общий')}
                <small>${e.percent}% · ${new Date(e.date).toLocaleDateString('ru-RU')}</small>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="dashboard-header">
        <h1>Привет, ${escapeHtml(state.userName)}!</h1>
        <p class="dashboard-greeting">Добро пожаловать в Haier Academic — техническую академию телевизоров</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.completed}</div>
          <div class="stat-label">Уроков пройдено</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.exams}</div>
          <div class="stat-label">Экзаменов</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.avgScore}%</div>
          <div class="stat-label">Средний балл</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${state.xp}</div>
          <div class="stat-label">Опыт (XP)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${state.level}</div>
          <div class="stat-label">Уровень</div>
        </div>
      </div>

      <div class="section-title">Прогресс по направлениям</div>
      <div class="progress-grid">
        ${progressCards}
      </div>

      <div class="section-title">Рекомендации</div>
      <div class="recommendations">
        <div class="rec-list" id="rec-list">
          ${recHtml}
        </div>
      </div>

      <div class="flex gap-2 mt-2">
        <button class="btn btn-primary" id="btn-continue">Продолжить обучение</button>
        <button class="btn btn-secondary" id="btn-exam">Пройти экзамен</button>
      </div>

      ${recentExams}
    `;
  }

  // ===== RENDER: ACADEMY =====
  function renderAcademy() {
    const coursesHtml = ACADEMY_DATA.courses.map(course => {
      const pct = getCourseProgress(course.id);
      const modulesHtml = course.modules.map(mod => {
        const lessonsHtml = mod.lessons.map(lid => {
          const lesson = ACADEMY_DATA.lessons[lid];
          if (!lesson) return '';
          const done = !!state.completedLessons[lid];
          return `
            <div class="lesson-item ${done ? 'completed' : ''}" data-lesson="${lid}">
              <span class="lesson-status">${done ? '✓' : '○'}</span>
              <span class="lesson-title">${escapeHtml(lesson.title)}</span>
              <span class="lesson-duration">${lesson.duration || ''}</span>
            </div>
          `;
        }).join('');
        return `
          <div class="module-item">
            <div class="module-title">${escapeHtml(mod.title)}</div>
            <div class="lesson-list">${lessonsHtml}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="course-card" data-course="${course.id}">
          <div class="course-header">
            <div class="course-icon">${course.icon}</div>
            <div class="course-info">
              <div class="course-title">${escapeHtml(course.title)}</div>
              <div class="course-desc">${escapeHtml(course.description)}</div>
              <div class="course-meta">
                <span>${course.modules.reduce((s, m) => s + m.lessons.length, 0)} уроков</span>
                <span>Прогресс ${pct}%</span>
              </div>
              <div class="course-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${pct}%"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="course-body">
            <div class="module-list">${modulesHtml}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <h1 class="mb-2">Академия</h1>
      <p class="text-secondary mb-3">Курсы от базовых принципов до инженерных деталей. Обучение построено на реальных технических принципах.</p>
      <div class="course-list">${coursesHtml}</div>
    `;
  }

  function bindAcademyEvents() {
    document.querySelectorAll('.course-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('open');
      });
    });
    document.querySelectorAll('.lesson-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = item.dataset.lesson;
        navigate('lesson', { lessonId: id });
      });
    });
  }

  // ===== RENDER: LESSON =====
  function renderLesson(lessonId) {
    const lesson = ACADEMY_DATA.lessons[lessonId];
    if (!lesson) {
      return `<div class="empty-state"><p>Урок не найден</p><button class="btn btn-primary" data-goto="academy">К академии</button></div>`;
    }
    const course = ACADEMY_DATA.courses.find(c => c.id === lesson.courseId);
    const done = !!state.completedLessons[lessonId];

    return `
      <div class="lesson-view">
        <div class="lesson-back" data-goto="academy">← Назад к академии</div>
        <div class="lesson-header">
          <h1>${escapeHtml(lesson.title)}</h1>
          <div class="lesson-meta">
            <span>${course ? course.title : ''}</span>
            <span>${lesson.duration || ''}</span>
            ${done ? '<span style="color:var(--success)">✓ Пройден</span>' : ''}
          </div>
        </div>
        <div class="lesson-content">
          ${lesson.content}
        </div>
        <div class="lesson-actions">
          ${!done ? `<button class="btn btn-primary" id="btn-complete-lesson">Отметить как пройденный (+15 XP)</button>` : ''}
          <button class="btn btn-secondary" data-goto="academy">К списку курсов</button>
          <button class="btn btn-outline" id="btn-lesson-quiz">Проверить знания</button>
        </div>
      </div>
    `;
  }

  function bindLessonEvents(lessonId) {
    const completeBtn = document.getElementById('btn-complete-lesson');
    if (completeBtn) {
      completeBtn.addEventListener('click', () => {
        state.completedLessons[lessonId] = Date.now();
        addXP(15);
        saveState();
        navigate('lesson', { lessonId });
      });
    }
    const quizBtn = document.getElementById('btn-lesson-quiz');
    if (quizBtn) {
      quizBtn.addEventListener('click', () => {
        const lesson = ACADEMY_DATA.lessons[lessonId];
        navigate('quiz', {
          level: 'basic',
          category: lesson.courseId,
          count: 5
        });
      });
    }
  }

  // ===== RENDER: EXAM CENTER =====
  function renderExamCenter() {
    return `
      <h1 class="mb-2">Центр экзаменов</h1>
      <p class="text-secondary mb-3">Проверка понимания физических принципов, умение анализировать характеристики и отличать маркетинг от реальности.</p>

      <div class="section-title">Уровень сложности</div>
      <div class="exam-levels" id="exam-levels">
        <div class="level-card selected" data-level="basic">
          <div class="level-name">Basic</div>
          <div class="level-desc">Базовые знания и термины</div>
          <span class="level-badge-tag">Начальный</span>
        </div>
        <div class="level-card" data-level="expert">
          <div class="level-name">Expert</div>
          <div class="level-desc">Уверенное техническое понимание</div>
          <span class="level-badge-tag">Средний</span>
        </div>
        <div class="level-card" data-level="pro">
          <div class="level-name">Pro</div>
          <div class="level-desc">Продвинутые технические вопросы</div>
          <span class="level-badge-tag">Продвинутый</span>
        </div>
        <div class="level-card" data-level="master">
          <div class="level-name">Master</div>
          <div class="level-desc">Инженерный анализ и задачи</div>
          <span class="level-badge-tag">Эксперт</span>
        </div>
      </div>

      <div class="section-title">Категория</div>
      <div class="exam-categories" id="exam-categories">
        <span class="cat-chip active" data-cat="all">Все темы</span>
        <span class="cat-chip" data-cat="matrices">Матрицы</span>
        <span class="cat-chip" data-cat="backlight">Подсветка</span>
        <span class="cat-chip" data-cat="gaming">Игровые</span>
        <span class="cat-chip" data-cat="image_processing">Обработка</span>
        <span class="cat-chip" data-cat="processors">Процессоры</span>
      </div>

      <button class="btn btn-primary mt-2" id="btn-start-exam">Начать экзамен</button>

      ${state.examHistory.length ? `
        <div class="section-title mt-3">История</div>
        <div class="rec-list">
          ${state.examHistory.slice(-10).reverse().map(e => `
            <div class="rec-item">
              <span class="rec-icon">${e.percent >= 70 ? '✅' : '📋'}</span>
              <div class="rec-text">
                ${escapeHtml(e.level)} · ${escapeHtml(e.category || 'Все')} · ${e.correct}/${e.total}
                <small>${e.percent}% · ${new Date(e.date).toLocaleString('ru-RU')}</small>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  function bindExamCenterEvents() {
    let selectedLevel = 'basic';
    let selectedCat = 'all';

    document.querySelectorAll('#exam-levels .level-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('#exam-levels .level-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedLevel = card.dataset.level;
      });
    });

    document.querySelectorAll('#exam-categories .cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#exam-categories .cat-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedCat = chip.dataset.cat;
      });
    });

    document.getElementById('btn-start-exam')?.addEventListener('click', () => {
      navigate('quiz', {
        level: selectedLevel,
        category: selectedCat === 'all' ? null : selectedCat,
        count: state.settings.examQuestionCount || 10
      });
    });
  }

  // ===== QUIZ ENGINE =====
  function startQuiz(params) {
    const { level, category, count } = params;
    let pool = ACADEMY_DATA.questions.filter(q => {
      if (level && q.difficulty !== level) {
        // Allow higher difficulties to appear in lower? No — strict match for now
        // For basic also include nothing else
        return q.difficulty === level;
      }
      return true;
    });

    if (category) {
      pool = pool.filter(q => q.courseId === category);
    }

    // Fallback: if too few, relax difficulty
    if (pool.length < 3) {
      pool = ACADEMY_DATA.questions.filter(q => !category || q.courseId === category);
    }

    pool = shuffle(pool).slice(0, Math.min(count || 10, pool.length));

    if (pool.length === 0) {
      document.getElementById('main-content').innerHTML = `
        <div class="empty-state">
          <div class="icon">📝</div>
          <p>Недостаточно вопросов для выбранных параметров.</p>
          <button class="btn btn-primary" data-goto="exams">Назад</button>
        </div>
      `;
      return;
    }

    // Prepare questions with shuffled options
    const examQuestions = pool.map(q => {
      const indices = q.options.map((_, i) => i);
      const shuffledIndices = shuffle(indices);
      const newOptions = shuffledIndices.map(i => q.options[i]);
      const newCorrect = q.correctAnswers.map(oldIdx => shuffledIndices.indexOf(oldIdx));
      return {
        ...q,
        options: newOptions,
        correctAnswers: newCorrect,
        originalCorrect: q.correctAnswers
      };
    });

    state.currentExam = {
      questions: examQuestions,
      currentIndex: 0,
      answers: {},
      level: level || 'mixed',
      category: category || 'all',
      startTime: Date.now()
    };

    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const exam = state.currentExam;
    if (!exam) return;

    const q = exam.questions[exam.currentIndex];
    const isMulti = q.type === 'multiple';
    const total = exam.questions.length;
    const idx = exam.currentIndex;
    const answered = exam.answers[q.id];

    const optionsHtml = q.options.map((opt, i) => {
      let cls = 'quiz-option' + (isMulti ? ' multi' : '');
      if (answered) {
        if (answered.selected.includes(i)) cls += ' selected';
        if (answered.showResult) {
          if (q.correctAnswers.includes(i)) cls += ' correct';
          else if (answered.selected.includes(i)) cls += ' incorrect';
        }
      } else if (answered && answered.selected.includes(i)) {
        cls += ' selected';
      }
      return `
        <div class="${cls}" data-idx="${i}">
          <span class="option-marker">${isMulti ? (answered?.selected.includes(i) ? '✓' : '') : String.fromCharCode(65 + i)}</span>
          <span>${escapeHtml(opt)}</span>
        </div>
      `;
    }).join('');

    let explanationHtml = '';
    if (answered && answered.showResult) {
      explanationHtml = `
        <div class="quiz-explanation">
          <strong>${answered.isCorrect ? 'Верно!' : 'Неверно.'}</strong><br>
          ${escapeHtml(q.explanation)}
        </div>
      `;
    }

    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="quiz-container">
        <div class="quiz-header">
          <div class="quiz-progress-text">Вопрос ${idx + 1} из ${total} · ${escapeHtml(exam.level)}</div>
          <div class="progress-bar" style="width:120px">
            <div class="progress-fill" style="width:${((idx + (answered?.showResult ? 1 : 0)) / total) * 100}%"></div>
          </div>
        </div>
        <div class="quiz-question">
          <div class="quiz-question-text">${escapeHtml(q.question)}</div>
          ${isMulti ? '<p class="text-xs text-muted mb-1">Выберите все правильные варианты</p>' : ''}
          <div class="quiz-options" id="quiz-options">${optionsHtml}</div>
          ${explanationHtml}
        </div>
        <div class="quiz-actions">
          ${!answered || !answered.showResult
            ? `<button class="btn btn-primary" id="btn-check-answer" ${!answered ? 'disabled' : ''}>Проверить</button>`
            : idx < total - 1
              ? `<button class="btn btn-primary" id="btn-next-question">Следующий</button>`
              : `<button class="btn btn-primary" id="btn-finish-exam">Завершить</button>`
          }
          <button class="btn btn-outline" data-goto="exams">Выйти</button>
        </div>
      </div>
    `;

    // Bind option clicks
    if (!answered || !answered.showResult) {
      document.querySelectorAll('#quiz-options .quiz-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const i = parseInt(opt.dataset.idx, 10);
          if (!exam.answers[q.id]) {
            exam.answers[q.id] = { selected: [], showResult: false };
          }
          const ans = exam.answers[q.id];
          if (isMulti) {
            const pos = ans.selected.indexOf(i);
            if (pos >= 0) ans.selected.splice(pos, 1);
            else ans.selected.push(i);
          } else {
            ans.selected = [i];
          }
          renderQuizQuestion();
        });
      });
    }

    document.getElementById('btn-check-answer')?.addEventListener('click', () => {
      const ans = exam.answers[q.id];
      if (!ans || ans.selected.length === 0) return;
      const correctSet = new Set(q.correctAnswers);
      const selectedSet = new Set(ans.selected);
      const isCorrect =
        correctSet.size === selectedSet.size &&
        [...correctSet].every(x => selectedSet.has(x));
      ans.isCorrect = isCorrect;
      ans.showResult = true;

      if (!isCorrect) {
        const topic = q.topic || q.courseId;
        state.weakTopics[topic] = (state.weakTopics[topic] || 0) + 1;
      }
      renderQuizQuestion();
    });

    document.getElementById('btn-next-question')?.addEventListener('click', () => {
      exam.currentIndex++;
      renderQuizQuestion();
    });

    document.getElementById('btn-finish-exam')?.addEventListener('click', () => {
      finishExam();
    });
  }

  function finishExam() {
    const exam = state.currentExam;
    if (!exam) return;

    let correct = 0;
    exam.questions.forEach(q => {
      const ans = exam.answers[q.id];
      if (ans && ans.isCorrect) correct++;
    });
    const total = exam.questions.length;
    const percent = Math.round((correct / total) * 100);

    const result = {
      date: Date.now(),
      level: exam.level,
      category: exam.category,
      correct,
      total,
      percent
    };
    state.examHistory.push(result);

    // XP
    let xpGain = correct * 10;
    if (percent >= 90) xpGain += 30;
    if (exam.level === 'expert') xpGain = Math.round(xpGain * 1.2);
    if (exam.level === 'pro') xpGain = Math.round(xpGain * 1.5);
    if (exam.level === 'master') xpGain = Math.round(xpGain * 2);
    addXP(xpGain);

    if (state.examHistory.length === 1) unlockAchievement('ach_first_exam');
    if (percent >= 90) unlockAchievement('ach_90_percent');
    if (exam.level === 'expert' && percent >= 70) unlockAchievement('ach_expert');
    if (exam.level === 'pro' && percent >= 70) unlockAchievement('ach_pro');
    if (exam.level === 'master' && percent >= 70) unlockAchievement('ach_master');

    saveState();
    state.currentExam = null;

    document.getElementById('main-content').innerHTML = `
      <div class="results-card">
        <div class="results-score">${percent}%</div>
        <div class="results-label">${correct} из ${total} правильных</div>
        <div class="results-details">
          <div><span>Уровень</span><span>${escapeHtml(exam.level)}</span></div>
          <div><span>Категория</span><span>${escapeHtml(exam.category)}</span></div>
          <div><span>Получено XP</span><span>+${xpGain}</span></div>
        </div>
        <div class="flex gap-1" style="justify-content:center">
          <button class="btn btn-primary" data-goto="exams">К экзаменам</button>
          <button class="btn btn-secondary" data-goto="dashboard">Dashboard</button>
        </div>
      </div>
    `;
  }

  // ===== ENCYCLOPEDIA =====
  function renderEncyclopedia() {
    const terms = ACADEMY_DATA.encyclopedia;
    const cards = terms.map(t => `
      <div class="term-card" data-term="${t.id}">
        <div class="term-name">${escapeHtml(t.name)}</div>
        <div class="term-def">${escapeHtml(t.definition)}</div>
        <div class="term-tags">
          ${(t.related || []).slice(0, 3).map(r => {
            const rel = ACADEMY_DATA.encyclopedia.find(x => x.id === r);
            return rel ? `<span class="term-tag">${escapeHtml(rel.name)}</span>` : '';
          }).join('')}
        </div>
      </div>
    `).join('');

    return `
      <h1 class="mb-2">Энциклопедия</h1>
      <p class="text-secondary mb-2">Технические термины с определениями, принципами работы и связями.</p>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="search" class="search-input" id="term-search" placeholder="Поиск по терминам...">
      </div>
      <div class="terms-grid" id="terms-grid">${cards}</div>
    `;
  }

  function bindEncyclopediaEvents() {
    document.getElementById('term-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const grid = document.getElementById('terms-grid');
      const filtered = ACADEMY_DATA.encyclopedia.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q)
      );
      grid.innerHTML = filtered.map(t => `
        <div class="term-card" data-term="${t.id}">
          <div class="term-name">${escapeHtml(t.name)}</div>
          <div class="term-def">${escapeHtml(t.definition)}</div>
        </div>
      `).join('') || '<p class="text-secondary">Ничего не найдено</p>';
      bindTermCards();
    });
    bindTermCards();
  }

  function bindTermCards() {
    document.querySelectorAll('.term-card').forEach(card => {
      card.addEventListener('click', () => {
        navigate('term', { termId: card.dataset.term });
      });
    });
  }

  function renderTerm(termId) {
    const t = ACADEMY_DATA.encyclopedia.find(x => x.id === termId);
    if (!t) return `<div class="empty-state"><p>Термин не найден</p></div>`;

    state.viewedTerms[termId] = true;
    saveState();
    checkAchievements();

    const related = (t.related || []).map(rid => {
      const r = ACADEMY_DATA.encyclopedia.find(x => x.id === rid);
      return r ? `<span class="related-link" data-term="${r.id}">${escapeHtml(r.name)}</span>` : '';
    }).join('');

    return `
      <div class="term-detail">
        <div class="lesson-back" data-goto="encyclopedia">← К энциклопедии</div>
        <h1>${escapeHtml(t.name)}</h1>
        <div class="term-section">
          <h3>Определение</h3>
          <p>${escapeHtml(t.definition)}</p>
        </div>
        ${t.principle ? `
          <div class="term-section">
            <h3>Принцип работы</h3>
            <p>${escapeHtml(t.principle)}</p>
          </div>
        ` : ''}
        ${t.variants && t.variants.length ? `
          <div class="term-section">
            <h3>Разновидности</h3>
            <p>${t.variants.map(escapeHtml).join(', ')}</p>
          </div>
        ` : ''}
        ${t.pros && t.pros.length ? `
          <div class="term-section">
            <h3>Преимущества</h3>
            <ul>${t.pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${t.cons && t.cons.length ? `
          <div class="term-section">
            <h3>Недостатки</h3>
            <ul>${t.cons.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${related ? `
          <div class="term-section">
            <h3>Связанные термины</h3>
            <div class="related-terms">${related}</div>
          </div>
        ` : ''}
        ${t.lessonIds && t.lessonIds.length ? `
          <div class="term-section">
            <h3>Уроки</h3>
            <div class="related-terms">
              ${t.lessonIds.map(lid => {
                const les = ACADEMY_DATA.lessons[lid];
                return les ? `<span class="related-link" data-lesson="${lid}">${escapeHtml(les.title)}</span>` : '';
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ===== SALES =====
  function renderSales() {
    const scenarios = ACADEMY_DATA.salesScenarios.map(s => `
      <div class="scenario-card" data-scenario="${s.id}">
        <div class="scenario-title">${escapeHtml(s.title)}</div>
        <div class="scenario-desc">${escapeHtml(s.description)} · ${s.difficulty}</div>
      </div>
    `).join('');

    return `
      <h1 class="mb-2">Практика продаж (DNS Sales Practice)</h1>
      <p class="text-secondary mb-3">Отработка общения с покупателями. Оценка по технической точности, честности, понятности и навыку работы с возражениями.</p>
      <div class="scenario-list">${scenarios}</div>
      <div class="empty-state mt-3">
        <p class="text-sm text-muted">Интерактивные диалоги будут расширены на следующем этапе. Сейчас доступны сценарии для подготовки и самопроверки.</p>
      </div>
    `;
  }

  // ===== COMPARISONS =====
  function renderComparisons() {
    return `
      <h1 class="mb-2">Сравнение брендов</h1>
      <p class="text-secondary mb-3">Технические сравнения без маркетинговых лозунгов. Сравниваются конкретные решения и условия использования.</p>
      <div class="empty-state">
        <div class="icon">⚖️</div>
        <p>Раздел в разработке. Будут добавлены сравнения:</p>
        <ul class="text-sm text-secondary" style="text-align:left;display:inline-block">
          <li>Haier Mini LED vs TCL Mini LED</li>
          <li>Haier QD-Mini LED vs Hisense QD-Mini LED</li>
          <li>OLED vs Mini LED по сценариям</li>
          <li>VA vs ADS / IPS</li>
          <li>Глянцевое vs матовое покрытие</li>
        </ul>
        <p class="mt-2 text-sm">Принцип: не объявлять один бренд «всегда лучше».</p>
      </div>
    `;
  }

  // ===== DATABASE =====
  function renderDatabase() {
    return `
      <h1 class="mb-2">База моделей телевизоров</h1>
      <p class="text-secondary mb-3">Каталог с фильтрами. Критическое правило: только подтверждённые данные. Нет данных → «Нет достоверных данных».</p>
      <div class="empty-state">
        <div class="icon">📺</div>
        <p>База наполняется. Добавляйте модели только с указанием источников (официальные спецификации, независимые измерения).</p>
        <p class="text-sm text-muted mt-1">Региональные версии различаются — не переносите характеристики без проверки.</p>
      </div>
    `;
  }

  // ===== PROFILE =====
  function renderProfile() {
    const stats = getOverallStats();
    const achHtml = ACADEMY_DATA.achievements.map(a => {
      const unlocked = !!state.achievements[a.id];
      return `
        <div class="achievement ${unlocked ? 'unlocked' : ''}">
          <div class="achievement-icon">${a.icon}</div>
          <div class="achievement-name">${escapeHtml(a.name)}</div>
          <div class="achievement-desc">${escapeHtml(a.desc)}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="profile-header">
        <div class="profile-avatar">${state.userName.charAt(0).toUpperCase()}</div>
        <div class="profile-info">
          <h1>${escapeHtml(state.userName)}</h1>
          <div class="profile-level">Уровень ${state.level} · ${state.xp} XP</div>
        </div>
      </div>

      <div class="stats-grid mb-3">
        <div class="stat-card">
          <div class="stat-value">${stats.completed}</div>
          <div class="stat-label">Уроков</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.exams}</div>
          <div class="stat-label">Экзаменов</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.avgScore}%</div>
          <div class="stat-label">Средний балл</div>
        </div>
      </div>

      <div class="section-title">Достижения</div>
      <div class="achievements-grid">${achHtml}</div>

      <div class="section-title mt-3">Слабые темы</div>
      ${Object.keys(state.weakTopics).length === 0
        ? '<p class="text-secondary text-sm">Пока нет данных — пройдите экзамены</p>'
        : `<div class="rec-list">${Object.entries(state.weakTopics).sort((a,b)=>b[1]-a[1]).map(([t,c]) => `
            <div class="rec-item"><span class="rec-icon">📉</span><div class="rec-text">${escapeHtml(t)}<small>Ошибок: ${c}</small></div></div>
          `).join('')}</div>`
      }

      <div class="mt-3">
        <button class="btn btn-outline btn-sm" id="btn-reset-progress">Сбросить прогресс</button>
      </div>
    `;
  }

  // ===== EVENT DELEGATION =====
  function setupGlobalEvents() {
    document.body.addEventListener('click', (e) => {
      const goto = e.target.closest('[data-goto]');
      if (goto) {
        e.preventDefault();
        navigate(goto.dataset.goto);
        return;
      }

      const navItem = e.target.closest('[data-section]');
      if (navItem && (navItem.classList.contains('nav-item') || navItem.classList.contains('mobile-nav-item'))) {
        e.preventDefault();
        navigate(navItem.dataset.section);
        return;
      }

      const termLink = e.target.closest('[data-term]');
      if (termLink && !termLink.classList.contains('term-card')) {
        navigate('term', { termId: termLink.dataset.term });
        return;
      }

      const lessonLink = e.target.closest('[data-lesson]');
      if (lessonLink && lessonLink.classList.contains('related-link')) {
        navigate('lesson', { lessonId: lessonLink.dataset.lesson });
        return;
      }

      if (e.target.id === 'btn-continue') {
        navigate('academy');
      }
      if (e.target.id === 'btn-exam') {
        navigate('exams');
      }
      if (e.target.id === 'btn-reset-progress') {
        if (confirm('Сбросить весь прогресс? Это действие нельзя отменить.')) {
          localStorage.removeItem(STORAGE_KEY);
          location.reload();
        }
      }
    });

    // Mobile menu
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      let overlay = document.querySelector('.sidebar-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', () => {
          document.getElementById('sidebar').classList.remove('open');
          overlay.classList.remove('visible');
        });
      }
      overlay.classList.toggle('visible');
    });
  }

  // ===== INIT =====
  function init() {
    loadState();
    updateSidebarXP();
    setupGlobalEvents();

    // Hash routing
    const hash = location.hash.replace('#', '') || 'dashboard';
    if (['dashboard', 'academy', 'exams', 'encyclopedia', 'sales', 'comparisons', 'database', 'profile'].includes(hash)) {
      navigate(hash);
    } else {
      navigate('dashboard');
    }

    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#', '') || 'dashboard';
      if (['dashboard', 'academy', 'exams', 'encyclopedia', 'sales', 'comparisons', 'database', 'profile'].includes(h)) {
        navigate(h);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
