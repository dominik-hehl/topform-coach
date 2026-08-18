/* =========================================================
   TOPFORM COACH
   Core Application
   ========================================================= */

"use strict";

/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEY = "topform-coach-v1";

const defaultState = {
  user: {
    name: "Dominik",
    age: 29,
    height: 187,
    weight: 82,
    bodyFat: "",
    goals: [
      "Kraft",
      "Athletik",
      "Ausdauer",
      "Fußballleistung"
    ],
    equipment: [
      "Kurzhanteln bis 15 kg",
      "Kettlebell 10 kg",
      "Trainingsbank",
      "Widerstandsbänder",
      "Laufband",
      "Fahrrad"
    ]
  },

  schedule: {
    footballTraining: [2, 5],
    matchDay: 0
  },

  readiness: {},

  workouts: [],

  footballSessions: [],

  nutrition: {},

  settings: {
    route: "today"
  }
};


/* =========================================================
   STATE
   ========================================================= */

let state = loadState();


function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return structuredClone(defaultState);
    }

    return mergeObjects(
      structuredClone(defaultState),
      JSON.parse(saved)
    );
  } catch (error) {
    console.error("State konnte nicht geladen werden:", error);
    return structuredClone(defaultState);
  }
}


function mergeObjects(base, source) {
  Object.keys(source || {}).forEach((key) => {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof base[key] === "object"
    ) {
      base[key] = mergeObjects(base[key], source[key]);
    } else {
      base[key] = source[key];
    }
  });

  return base;
}


function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error("State konnte nicht gespeichert werden:", error);
  }
}


/* =========================================================
   HELPERS
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) =>
  [...document.querySelectorAll(selector)];


function todayKey() {
  return new Date().toISOString().slice(0, 10);
}


function formatDate(date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}


function getDayName(day) {
  return [
    "Sonntag",
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag"
  ][day];
}


function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    max
  );
}


function average(values) {
  if (!values.length) return 0;

  return values.reduce(
    (sum, value) => sum + value,
    0
  ) / values.length;
}


function showToast(message) {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}


/* =========================================================
   DATE / LOAD
   ========================================================= */

function getRecentLoad(hours = 48) {
  const now = Date.now();

  const workoutLoad = state.workouts
    .filter((workout) => {
      const time =
        new Date(workout.date).getTime();

      return now - time <= hours * 60 * 60 * 1000;
    })
    .reduce(
      (sum, workout) =>
        sum +
        (workout.duration || 0) *
        (workout.rpe || 0),
      0
    );

  const footballLoad = state.footballSessions
    .filter((session) => {
      const time =
        new Date(session.date).getTime();

      return now - time <= hours * 60 * 60 * 1000;
    })
    .reduce(
      (sum, session) =>
        sum +
        (session.duration || 0) *
        (session.rpe || 0),
      0
    );

  return workoutLoad + footballLoad;
}


function getWeeklyLoad() {
  const now = Date.now();

  const week = 7 * 24 * 60 * 60 * 1000;

  const workoutLoad = state.workouts
    .filter((workout) => {
      const time =
        new Date(workout.date).getTime();

      return now - time <= week;
    })
    .reduce(
      (sum, workout) =>
        sum +
        (workout.duration || 0) *
        (workout.rpe || 0),
      0
    );

  const footballLoad = state.footballSessions
    .filter((session) => {
      const time =
        new Date(session.date).getTime();

      return now - time <= week;
    })
    .reduce(
      (sum, session) =>
        sum +
        (session.duration || 0) *
        (session.rpe || 0),
      0
    );

  return workoutLoad + footballLoad;
}


/* =========================================================
   READINESS
   ========================================================= */

function getTodayReadiness() {
  const data =
    state.readiness[todayKey()] || {};

  const recovery =
    Number(data.recovery ?? 7);

  const fatigue =
    Number(data.fatigue ?? 3);

  const pain =
    Number(data.pain ?? 0);

  const recentLoad =
    getRecentLoad(48);

  /*
    Base score:
    50
    + recovery
    - fatigue
    - pain
    - recent load penalty
  */

  let score = 50;

  score += (recovery - 5) * 7;
  score -= (fatigue - 3) * 7;
  score -= pain * 4;

  if (recentLoad > 700) {
    score -= 18;
  } else if (recentLoad > 500) {
    score -= 10;
  } else if (recentLoad > 350) {
    score -= 5;
  }

  score = Math.round(
    clamp(score, 20, 100)
  );

  let status = "Gut";

  if (score >= 85) {
    status = "Sehr gut";
  } else if (score >= 70) {
    status = "Gut";
  } else if (score >= 50) {
    status = "Mittel";
  } else {
    status = "Niedrig";
  }

  return {
    score,
    status,
    recovery,
    fatigue,
    pain,
    recentLoad
  };
}


/* =========================================================
   DAILY RECOMMENDATION
   ========================================================= */

function getRecommendation() {
  const today = new Date();
  const day = today.getDay();

  const readiness =
    getTodayReadiness();

  const yesterday =
    new Date(today);

  yesterday.setDate(
    today.getDate() - 1
  );

  const yesterdayKey =
    yesterday.toISOString().slice(0, 10);

  const yesterdayFootball =
    state.footballSessions.some(
      (session) =>
        session.date.startsWith(yesterdayKey)
    );

  /* Very low readiness always wins. */

  if (
    readiness.score < 45 ||
    readiness.pain >= 5
  ) {
    return {
      type: "recovery",
      title: "Aktive Regeneration",
      duration: 20,
      goal: "Erholung & Beweglichkeit",
      reason:
        readiness.pain >= 5
          ? "Du hast erhöhte Schmerzen angegeben. Heute reduzieren wir die Belastung."
          : "Deine aktuelle Erholung ist zu niedrig für eine harte Belastung.",
      exercises: [
        "10–15 Min. lockeres Fahrrad oder Gehen",
        "Mobility für Hüfte und Sprunggelenke",
        "Leichte Core-Aktivierung"
      ]
    };
  }

  /* Match day */

  if (day === 0) {
    return {
      type: "football",
      title: "Spieltag",
      duration: 90,
      goal: "Maximale Fußballleistung",
      reason:
        "Heute zählt die Fußballleistung. Keine zusätzliche harte Belastung.",
      exercises: [
        "Individuelles Warm-up",
        "Spiel",
        "Cooldown & Regeneration"
      ]
    };
  }

  /* Friday football */

  if (day === 5) {
    return {
      type: "football",
      title: "Fußballtraining",
      duration: 90,
      goal: "Fußball & Spielvorbereitung",
      reason:
        "Das Fußballtraining ist heute bereits deine Hauptbelastung.",
      exercises: [
        "Fußballtraining",
        "Nach dem Training RPE erfassen",
        "Cooldown"
      ]
    };
  }

  /* Tuesday football */

  if (day === 2) {
    return {
      type: "football",
      title: "Fußballtraining",
      duration: 90,
      goal: "Fußballleistung",
      reason:
        "Heute ist deine reguläre Fußballbelastung eingeplant.",
      exercises: [
        "Fußballtraining",
        "Nach dem Training RPE erfassen",
        "Schmerzen dokumentieren"
      ]
    };
  }

  /* Saturday */

  if (day === 6) {
    return {
      type: "recovery",
      title: "Frisch bleiben",
      duration: 15,
      goal: "Regeneration vor dem Spiel",
      reason:
        "Morgen ist Spieltag. Heute keine harte Belastung.",
      exercises: [
        "10–15 Min. lockere Bewegung",
        "Mobility",
        "Früh schlafen"
      ]
    };
  }

  /* Wednesday */

  if (day === 3) {
    if (yesterdayFootball) {
      return {
        type: "strength",
        title: "Kraft & Athletik",
        duration: 38,
        goal: "Ganzkörperkraft & Athletik",
        reason:
          "Nach dem Fußballtraining gestern setzen wir heute einen kontrollierten Kraftreiz.",
        exercises: [
          "Goblet Squat",
          "Kurzhantel Romanian Deadlift",
          "Kurzhantel Bankdrücken",
          "Einarmiges Rudern",
          "Core"
        ]
      };
    }

    return {
      type: "strength",
      title: "Kraft & Athletik",
      duration: 42,
      goal: "Ganzkörperkraft & Explosivität",
      reason:
        "Mittwoch bietet das beste Fenster für einen hochwertigen Kraftreiz.",
      exercises: [
        "Goblet Squat",
        "Kurzhantel Romanian Deadlift",
        "Kurzhantel Bankdrücken",
        "Einarmiges Rudern",
        "Sprungvariation",
        "Core"
      ]
    };
  }

  /* Thursday */

  if (day === 4) {
    return {
      type: "conditioning",
      title: "Ausdauer & Mobility",
      duration: 30,
      goal: "Grundlagenausdauer & Beweglichkeit",
      reason:
        "Heute halten wir die Belastung kontrolliert und bereiten dich auf Freitag vor.",
      exercises: [
        "20 Min. lockeres Laufband oder Fahrrad",
        "Hüft-Mobility",
        "Sprunggelenk-Mobility",
        "Core"
      ]
    };
  }

  /* Monday */

  return {
    type: "strength",
    title: "Kraft & Athletik",
    duration: 35,
    goal: "Kraft erhalten & Körper aktivieren",
    reason:
      "Nach dem Spiel ist heute ein kontrollierter Einstieg sinnvoll.",
    exercises: [
      "Kurzhantel Press",
      "Einbeinige Kniebeuge",
      "Rudern",
      "Glute Bridge",
      "Core"
    ]
  };
}


/* =========================================================
   TODAY VIEW
   ========================================================= */

function renderToday() {
  const readiness =
    getTodayReadiness();

  const recommendation =
    getRecommendation();

  const today = new Date();

  const dateText =
    new Intl.DateTimeFormat(
      "de-DE",
      {
        weekday: "long",
        day: "numeric",
        month: "long"
      }
    ).format(today);

  const recentLoad =
    Math.round(readiness.recentLoad);

  $("#main-content").innerHTML = `
    <section class="section">

      <p class="eyebrow">
        ${dateText}
      </p>

      <h1 class="page-title">
        Heute
      </h1>

      <p class="page-subtitle">
        Deine wichtigste Entscheidung für langfristige Performance.
      </p>

    </section>


    <section class="section">

      <div class="card readiness-card">

        <div class="card-header">
          <span class="eyebrow">
            READINESS
          </span>

          <span class="badge ${
            readiness.score >= 70
              ? "accent"
              : readiness.score >= 50
                ? "warning"
                : "danger"
          }">
            ${readiness.status}
          </span>
        </div>

        <div class="readiness-row">

          <div>

            <div class="readiness-score">
              <strong>
                ${readiness.score}
              </strong>

              <span>/100</span>
            </div>

            <div class="readiness-status">
              ${getReadinessHeadline(readiness.score)}
            </div>

          </div>

          <div
            class="readiness-ring"
            style="
              background:
              conic-gradient(
                var(--accent)
                ${readiness.score * 3.6}deg,
                var(--surface-3)
                ${readiness.score * 3.6}deg
              )
            "
          >
            <span>
              ${readiness.score}%
            </span>
          </div>

        </div>

        <p class="readiness-message">
          ${getReadinessMessage(readiness)}
        </p>

        <div class="workout-stats">

          <div class="stat-box">
            <strong>${readiness.recovery}/10</strong>
            <span>Erholung</span>
          </div>

          <div class="stat-box">
            <strong>${readiness.fatigue}/10</strong>
            <span>Müdigkeit</span>
          </div>

          <div class="stat-box">
            <strong>${recentLoad}</strong>
            <span>Load 48h</span>
          </div>

        </div>

        <button
          class="secondary-button"
          data-action="readiness"
          type="button"
        >
          Readiness aktualisieren
        </button>

      </div>

    </section>


    <section class="section">

      <div class="card today-card">

        <div class="card-header">

          <span class="eyebrow">
            HEUTE EMPFOHLEN
          </span>

          <span class="badge ${
            recommendation.type === "recovery"
              ? "success"
              : recommendation.type === "football"
                ? "accent"
                : ""
          }">
            ${getRecommendationLabel(recommendation.type)}
          </span>

        </div>

        <h2 class="workout-title">
          ${recommendation.title}
        </h2>

        <p class="workout-description">
          ${recommendation.reason}
        </p>

        <div class="workout-meta">

          <span class="badge">
            ${recommendation.duration} Min.
          </span>

          <span class="badge">
            ${recommendation.goal}
          </span>

        </div>

        <div class="list">

          ${recommendation.exercises
            .map(
              (exercise, index) => `
                <div class="list-item">

                  <div class="list-icon">
                    ${index + 1}
                  </div>

                  <div class="list-content">
                    <strong>
                      ${exercise}
                    </strong>
                    <span>
                      ${getExerciseHint(exercise)}
                    </span>
                  </div>

                </div>
              `
            )
            .join("")}

        </div>

        <button
          class="primary-button"
          data-action="start-workout"
          type="button"
        >
          TRAINING STARTEN
        </button>

      </div>

    </section>


    <section class="section">

      <h2 class="section-title">
        Diese Woche
      </h2>

      <div class="quick-grid">

        <div class="quick-card">
          <strong>
            ${getWeeklyTrainingCount()}
          </strong>
          <span>
            Einheiten
          </span>
        </div>

        <div class="quick-card">
          <strong>
            ${Math.round(getWeeklyLoad())}
          </strong>
          <span>
            Trainingsload
          </span>
        </div>

      </div>

    </section>
  `;
}

function getWeeklyTrainingCount() {
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);

  const day = weekStart.getDay();
  const difference = day === 0 ? 6 : day - 1;

  weekStart.setDate(
    weekStart.getDate() - difference
  );

  return state.workouts.filter((workout) => {
    return new Date(workout.date) >= weekStart;
  }).length;
}

function getReadinessHeadline(score) {
  if (score >= 85) return "Bereit für Leistung";
  if (score >= 70) return "Guter Trainingstag";
  if (score >= 50) return "Belastung kontrollieren";
  return "Regeneration priorisieren";
}


function getReadinessMessage(data) {
  if (data.pain >= 5) {
    return "Du hast erhöhte Schmerzen angegeben. Topform reduziert heute bewusst die Belastung.";
  }

  if (data.recentLoad > 700) {
    return "Deine Belastung der letzten 48 Stunden ist hoch. Heute zählt Erholung mehr als zusätzliches Volumen.";
  }

  if (data.score >= 85) {
    return "Deine Erholung ist stark. Heute kannst du einen hochwertigen Trainingsreiz setzen.";
  }

  if (data.score >= 70) {
    return "Deine Erholung ist ausreichend für die geplante Belastung.";
  }

  return "Deine aktuelle Erholung ist eingeschränkt. Wir halten die Belastung kontrolliert.";
}


function getRecommendationLabel(type) {
  const labels = {
    strength: "Kraft",
    conditioning: "Ausdauer",
    football: "Fußball",
    recovery: "Recovery"
  };

  return labels[type] || "Training";
}


function getExerciseHint(exercise) {
  if (exercise.includes("Squat")) {
    return "3 × 8–10 · RPE 7";
  }

  if (exercise.includes("Deadlift")) {
    return "3 × 8–10 · RPE 7";
  }

  if (exercise.includes("Bankdrücken")) {
    return "3 × 8–12 · RPE 7";
  }

  if (exercise.includes("Rudern")) {
    return "3 × 8–12 · RPE 7";
  }

  if (exercise.includes("Core")) {
    return "3 Sätze · kontrolliert";
  }

  if (exercise.includes("Sprung")) {
    return "3 × 5 · explosiv";
  }

  return "kontrollierte Intensität";
}


/* =========================================================
   READINESS MODAL
   ========================================================= */

function openReadinessModal() {
  const current =
    state.readiness[todayKey()] || {
      recovery: 7,
      fatigue: 3,
      pain: 0
    };

  $("#modal-root").innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-header">

          <h2 class="modal-title">
            Readiness
          </h2>

          <button
            class="close-button"
            data-action="close-modal"
            type="button"
          >
            ×
          </button>

        </div>

        <p class="page-subtitle">
          Kurz einschätzen. Topform passt deine heutige Belastung automatisch an.
        </p>


        <div class="form-group">

          <label class="form-label">
            Wie gut fühlst du dich erholt? 1–10
          </label>

          <input
            id="readiness-recovery"
            class="input"
            type="number"
            min="1"
            max="10"
            value="${current.recovery}"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Wie müde fühlst du dich? 1–10
          </label>

          <input
            id="readiness-fatigue"
            class="input"
            type="number"
            min="1"
            max="10"
            value="${current.fatigue}"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Schmerzen aktuell? 0–10
          </label>

          <input
            id="readiness-pain"
            class="input"
            type="number"
            min="0"
            max="10"
            value="${current.pain}"
          >

        </div>


        <button
          class="primary-button"
          data-action="save-readiness"
          type="button"
        >
          READINESS SPEICHERN
        </button>

      </div>

    </div>
  `;
}


/* =========================================================
   TRAINING VIEW
   ========================================================= */

function renderTraining() {
  const recommendation =
    getRecommendation();
  const recentActivities = [
  ...state.workouts.map((workout) => ({
    ...workout,
    activityType: "workout"
  })),

  ...state.footballSessions.map((session) => ({
    ...session,
    title:
      session.type === "Spiel"
        ? "Fußballspiel"
        : "Fußballtraining",
    activityType: "football"
  }))
]
  .sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  })
  .slice(0, 8);
  
  $("#main-content").innerHTML = `
    <section class="section">

      <p class="eyebrow">
        TRAINING
      </p>

      <h1 class="page-title">
        Dein Training
      </h1>

      <p class="page-subtitle">
        Trainiere gezielt statt einfach nur mehr.
      </p>

    </section>


    <section class="section">

      <div class="card today-card">

        <span class="eyebrow">
          HEUTE
        </span>

        <h2 class="workout-title">
          ${recommendation.title}
        </h2>

        <p class="workout-description">
          ${recommendation.reason}
        </p>

        <div class="workout-meta">

          <span class="badge accent">
            ${recommendation.duration} Min.
          </span>

          <span class="badge">
            ${recommendation.goal}
          </span>

        </div>

        <button
          class="primary-button"
          data-action="start-workout"
          type="button"
        >
          TRAINING STARTEN
        </button>

      </div>

    </section>


    <section class="section">

      <h2 class="section-title">
        Letzte Einheiten
      </h2>

      ${
        recentActivities.length
          ? `
            <div class="list">

              ${recentActivities.map(
                  (workout) => `
                    <div class="list-item">

                      <div class="list-icon">
                        ✓
                      </div>

                      <div class="list-content">

                        <strong>
                          ${workout.title}
                        </strong>

                        <span>
  ${formatDate(
    new Date(workout.date)
  )}
  ·
  ${workout.duration} Min.
  ·
  RPE ${workout.rpe}
  ${
    workout.pain > 0
      ? ` · Schmerz ${workout.pain}/10`
      : ""
  }
</span>

                      </div>

                    </div>
                  `
                )
                .join("")}

            </div>
          `
          : `
            <div class="empty-state">

              <div class="empty-state-icon">
                ▣
              </div>

              <strong>
                Noch keine Einheiten
              </strong>

              <p>
                Deine absolvierten Trainings erscheinen hier.
              </p>

            </div>
          `
      }

    </section>
  `;
}


/* =========================================================
   WORKOUT MODAL
   ========================================================= */

function startWorkout() {
  const recommendation =
    getRecommendation();

  if (recommendation.type === "football") {
    openFootballModal();
    return;
  }

  if (recommendation.type === "recovery") {
    openRecoveryModal();
    return;
  }

  openWorkoutModal(recommendation);
}


function openWorkoutModal(recommendation) {
  $("#modal-root").innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-header">

          <h2 class="modal-title">
            ${recommendation.title}
          </h2>

          <button
            class="close-button"
            data-action="close-modal"
            type="button"
          >
            ×
          </button>

        </div>

        <p class="page-subtitle">
          ${recommendation.goal}
        </p>


        <div class="list" style="margin-top:20px;">

          ${recommendation.exercises
            .map(
              (exercise, index) => `
                <div class="exercise-card">

                  <div class="exercise-header">

                    <div>

                      <div class="exercise-name">
                        ${exercise}
                      </div>

                      <div class="exercise-target">
                        ${getExerciseHint(exercise)}
                      </div>

                    </div>

                    <div class="exercise-number">
                      ${index + 1}
                    </div>

                  </div>

                </div>
              `
            )
            .join("")}

        </div>


        <div class="form-group">

          <label class="form-label">
            Gesamtdauer in Minuten
          </label>

          <input
            id="workout-duration"
            class="input"
            type="number"
            min="1"
            value="${recommendation.duration}"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Wie hart war das Training? RPE 1–10
          </label>

          <input
            id="workout-rpe"
            class="input"
            type="number"
            min="1"
            max="10"
            value="7"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Schmerzen 0–10
          </label>

          <input
            id="workout-pain"
            class="input"
            type="number"
            min="0"
            max="10"
            value="0"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Notiz optional
          </label>

          <textarea
            id="workout-note"
            class="textarea"
            rows="3"
            placeholder="Wie hat sich das Training angefühlt?"
          ></textarea>

        </div>


        <button
          class="primary-button"
          data-action="save-workout"
          type="button"
        >
          TRAINING ABSCHLIESSEN
        </button>

      </div>

    </div>
  `;
}


/* =========================================================
   FOOTBALL
   ========================================================= */

function openFootballModal() {
  $("#modal-root").innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-header">

          <h2 class="modal-title">
            Fußball erfassen
          </h2>

          <button
            class="close-button"
            data-action="close-modal"
            type="button"
          >
            ×
          </button>

        </div>

        <p class="page-subtitle">
          Fußball zählt bei Topform als echte Trainingsbelastung.
        </p>


        <div class="form-group">

          <label class="form-label">
            Art
          </label>

          <select
            id="football-type"
            class="select"
          >
            <option>Training</option>
            <option>Spiel</option>
          </select>

        </div>


        <div class="form-group">

          <label class="form-label">
            Dauer in Minuten
          </label>

          <input
            id="football-duration"
            class="input"
            type="number"
            value="90"
            min="1"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            RPE 1–10
          </label>

          <input
            id="football-rpe"
            class="input"
            type="number"
            value="7"
            min="1"
            max="10"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Schmerzen 0–10
          </label>

          <input
            id="football-pain"
            class="input"
            type="number"
            value="0"
            min="0"
            max="10"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Notiz optional
          </label>

          <textarea
            id="football-note"
            class="textarea"
            rows="3"
          ></textarea>

        </div>


        <button
          class="primary-button"
          data-action="save-football"
          type="button"
        >
          FUSSBALL SPEICHERN
        </button>

      </div>

    </div>
  `;
}


/* =========================================================
   RECOVERY
   ========================================================= */

function openRecoveryModal() {
  $("#modal-root").innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-header">

          <h2 class="modal-title">
            Regeneration
          </h2>

          <button
            class="close-button"
            data-action="close-modal"
            type="button"
          >
            ×
          </button>

        </div>

        <p class="page-subtitle">
          Heute geht es darum, Belastung abzubauen und morgen wieder leistungsfähig zu sein.
        </p>


        <div class="list" style="margin-top:20px;">

          <div class="list-item">
            <div class="list-icon">1</div>
            <div class="list-content">
              <strong>10–15 Min. lockere Bewegung</strong>
              <span>Fahrrad, Gehen oder sehr lockeres Laufband</span>
            </div>
          </div>

          <div class="list-item">
            <div class="list-icon">2</div>
            <div class="list-content">
              <strong>Mobility</strong>
              <span>Hüfte, Sprunggelenke und Rücken</span>
            </div>
          </div>

          <div class="list-item">
            <div class="list-icon">3</div>
            <div class="list-content">
              <strong>Keine harte Belastung</strong>
              <span>Frische für die nächste Leistungseinheit</span>
            </div>
          </div>

        </div>


        <button
          class="primary-button"
          data-action="complete-recovery"
          type="button"
        >
          REGENERATION ABSCHLIESSEN
        </button>

      </div>

    </div>
  `;
}


/* =========================================================
   WEEK VIEW
   ========================================================= */

function renderWeek() {
  const today = new Date();

  const monday =
    new Date(today);

  const day =
    today.getDay();

  const difference =
    day === 0 ? -6 : 1 - day;

  monday.setDate(
    today.getDate() + difference
  );

  const days =
    Array.from(
      { length: 7 },
      (_, index) => {
        const date =
          new Date(monday);

        date.setDate(
          monday.getDate() + index
        );

        return date;
      }
    );

  $("#main-content").innerHTML = `
    <section class="section">

      <p class="eyebrow">
        WOCHENPLAN
      </p>

      <h1 class="page-title">
        Deine Woche
      </h1>

      <p class="page-subtitle">
        Geplante und tatsächliche Belastung auf einen Blick.
      </p>

    </section>


    <section class="section">

      <div class="week-grid">

        ${days
          .map(
            (date) => {

              const isToday =
                date.toDateString() ===
                today.toDateString();

              const load =
                getLoadForDate(date);

              return `
                <div
                  class="day-card ${
                    isToday ? "active" : ""
                  }"
                >

                  <div class="day-name">
                    ${new Intl.DateTimeFormat(
                      "de-DE",
                      { weekday: "short" }
                    ).format(date)}
                  </div>

                  <div class="day-number">
                    ${date.getDate()}
                  </div>

                  <div class="day-load">
                    <span
                      style="
                        width:${Math.min(
                          100,
                          load / 3
                        )}%;
                      "
                    ></span>
                  </div>

                </div>
              `;
            }
          )
          .join("")}

      </div>

    </section>


    <section class="section">

      <h2 class="section-title">
        Belastungsplanung
      </h2>

      <div class="list">

        ${getWeekPlan()
          .map(
            (item) => `
              <div class="list-item">

                <div class="list-icon">
                  ${item.icon}
                </div>

                <div class="list-content">

                  <strong>
                    ${item.day}
                  </strong>

                  <span>
                    ${item.title}
                    ·
                    ${item.load}
                  </span>

                </div>

                <span class="badge ${item.class}">
                  ${item.status}
                </span>

              </div>
            `
          )
          .join("")}

      </div>

    </section>
  `;
}


function getLoadForDate(date) {
  const key =
    date.toISOString().slice(0, 10);

  const workouts =
    state.workouts
      .filter((item) =>
        item.date.startsWith(key)
      )
      .reduce(
        (sum, item) =>
          sum +
          item.duration *
          item.rpe,
        0
      );

  const football =
    state.footballSessions
      .filter((item) =>
        item.date.startsWith(key)
      )
      .reduce(
        (sum, item) =>
          sum +
          item.duration *
          item.rpe,
        0
      );

  return workouts + football;
}


function getWeekPlan() {
  return [
    {
      day: "Montag",
      title: "Regeneration / Kraft",
      load: "moderat",
      icon: "↻",
      status: "Kontrolliert",
      class: "success"
    },
    {
      day: "Dienstag",
      title: "Fußballtraining",
      load: "hoch",
      icon: "⚽",
      status: "Fußball",
      class: "accent"
    },
    {
      day: "Mittwoch",
      title: "Kraft & Athletik",
      load: "moderat",
      icon: "◆",
      status: "Leistung",
      class: "accent"
    },
    {
      day: "Donnerstag",
      title: "Ausdauer / Mobility",
      load: "leicht",
      icon: "↗",
      status: "Locker",
      class: "success"
    },
    {
      day: "Freitag",
      title: "Fußballtraining",
      load: "hoch",
      icon: "⚽",
      status: "Fußball",
      class: "accent"
    },
    {
      day: "Samstag",
      title: "Regeneration",
      load: "sehr leicht",
      icon: "↻",
      status: "Recovery",
      class: "success"
    },
    {
      day: "Sonntag",
      title: "Spiel",
      load: "sehr hoch",
      icon: "⚽",
      status: "Match",
      class: "warning"
    }
  ];
}


/* =========================================================
   PROGRESS VIEW
   ========================================================= */

function renderProgress() {
  const workoutCount =
    state.workouts.length;

  const footballCount =
    state.footballSessions.length;

  const weeklyLoad =
    Math.round(getWeeklyLoad());

  const totalDuration =
    state.workouts.reduce(
      (sum, item) =>
        sum + Number(item.duration || 0),
      0
    );

  $("#main-content").innerHTML = `
    <section class="section">

      <p class="eyebrow">
        ENTWICKLUNG
      </p>

      <h1 class="page-title">
        Fortschritt
      </h1>

      <p class="page-subtitle">
        Nicht nur Gewicht. Entscheidend ist deine Performance.
      </p>

    </section>


    <section class="section">

      <div class="quick-grid">

        <div class="quick-card">
          <strong>${workoutCount}</strong>
          <span>Kraft-Einheiten</span>
        </div>

        <div class="quick-card">
          <strong>${footballCount}</strong>
          <span>Fußball-Einheiten</span>
        </div>

        <div class="quick-card">
          <strong>${weeklyLoad}</strong>
          <span>Load diese Woche</span>
        </div>

        <div class="quick-card">
          <strong>${totalDuration}</strong>
          <span>Trainingsminuten</span>
        </div>

      </div>

    </section>


    <section class="section">

      <h2 class="section-title">
        Körper
      </h2>

      <div class="card today-card">

        <div class="workout-stats">

          <div class="stat-box">
            <strong>
              ${state.user.weight} kg
            </strong>
            <span>
              Gewicht
            </span>
          </div>

          <div class="stat-box">
            <strong>
              ${state.user.height} cm
            </strong>
            <span>
              Größe
            </span>
          </div>

          <div class="stat-box">
            <strong>
              ${state.user.bodyFat || "–"}
            </strong>
            <span>
              Körperfett
            </span>
          </div>

        </div>

      </div>

    </section>


    <section class="section">

      <h2 class="section-title">
        Performance
      </h2>

      <div class="list">

        <div class="list-item">

          <div class="list-icon">
            ◆
          </div>

          <div class="list-content">
            <strong>
              Kraft
            </strong>

            <span>
              Wird mit deinen geloggten Übungen aufgebaut.
            </span>
          </div>

        </div>


        <div class="list-item">

          <div class="list-icon">
            ↗
          </div>

          <div class="list-content">
            <strong>
              Athletik & Ausdauer
            </strong>

            <span>
              Trainingsvolumen und Belastung werden fortlaufend gespeichert.
            </span>
          </div>

        </div>


        <div class="list-item">

          <div class="list-icon">
            ⚽
          </div>

          <div class="list-content">
            <strong>
              Fußball
            </strong>

            <span>
              Training und Spiele fließen in deine Gesamtbelastung ein.
            </span>
          </div>

        </div>

      </div>

    </section>
  `;
}


/* =========================================================
   NUTRITION VIEW
   ========================================================= */

function renderNutrition() {
  const nutrition =
    state.nutrition[todayKey()] || {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    };

  const calorieTarget =
    getNutritionTarget();

  const proteinTarget = 160;

  const caloriePercent =
    clamp(
      (nutrition.calories /
        calorieTarget) *
        100,
      0,
      100
    );

  const proteinPercent =
    clamp(
      (nutrition.protein /
        proteinTarget) *
        100,
      0,
      100
    );

  $("#main-content").innerHTML = `
    <section class="section">

      <p class="eyebrow">
        ERNÄHRUNG
      </p>

      <h1 class="page-title">
        Ernährung
      </h1>

      <p class="page-subtitle">
        Einfach genug für den Alltag. Präzise genug für Performance.
      </p>

    </section>


    <section class="section">

      <div class="card today-card">

        <div class="card-header">

          <span class="eyebrow">
            HEUTE
          </span>

          <span class="badge accent">
            ${getNutritionDayType()}
          </span>

        </div>


        <div class="workout-stats">

          <div class="stat-box">
            <strong>
              ${nutrition.calories}
            </strong>
            <span>
              kcal
            </span>
          </div>

          <div class="stat-box">
            <strong>
              ${nutrition.protein} g
            </strong>
            <span>
              Protein
            </span>
          </div>

          <div class="stat-box">
            <strong>
              ${nutrition.carbs} g
            </strong>
            <span>
              Kohlenhydrate
            </span>
          </div>

        </div>


        <div class="form-group">

          <div class="card-header">
            <span class="form-label">
              Kalorien
            </span>

            <span class="form-label">
              Ziel ${calorieTarget}
            </span>
          </div>

          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width:${caloriePercent}%"
            ></div>
          </div>

        </div>


        <div class="form-group">

          <div class="card-header">
            <span class="form-label">
              Protein
            </span>

            <span class="form-label">
              Ziel ${proteinTarget} g
            </span>
          </div>

          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width:${proteinPercent}%"
            ></div>
          </div>

        </div>


        <button
          class="primary-button"
          data-action="nutrition-log"
          type="button"
        >
          ERNÄHRUNG EINTRAGEN
        </button>

      </div>

    </section>
  `;
}


function getNutritionTarget() {
  const day =
    new Date().getDay();

  if (day === 0 || day === 2 || day === 5) {
    return 2600;
  }

  return 2400;
}


function getNutritionDayType() {
  const day =
    new Date().getDay();

  if (day === 0) return "Spieltag";
  if (day === 2 || day === 5) return "Fußball";
  if (day === 3) return "Kraft";
  if (day === 4) return "Ausdauer";

  return "Recovery";
}


function openNutritionModal() {
  const nutrition =
    state.nutrition[todayKey()] || {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    };

  $("#modal-root").innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-header">

          <h2 class="modal-title">
            Ernährung
          </h2>

          <button
            class="close-button"
            data-action="close-modal"
            type="button"
          >
            ×
          </button>

        </div>


        <div class="form-group">

          <label class="form-label">
            Kalorien
          </label>

          <input
            id="nutrition-calories"
            class="input"
            type="number"
            min="0"
            value="${nutrition.calories}"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Protein in g
          </label>

          <input
            id="nutrition-protein"
            class="input"
            type="number"
            min="0"
            value="${nutrition.protein}"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Kohlenhydrate in g
          </label>

          <input
            id="nutrition-carbs"
            class="input"
            type="number"
            min="0"
            value="${nutrition.carbs}"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Fett in g
          </label>

          <input
            id="nutrition-fat"
            class="input"
            type="number"
            min="0"
            value="${nutrition.fat}"
          >

        </div>


        <button
          class="primary-button"
          data-action="save-nutrition"
          type="button"
        >
          SPEICHERN
        </button>

      </div>

    </div>
  `;
}


/* =========================================================
   SAVE ACTIONS
   ========================================================= */

function saveReadiness() {
  state.readiness[todayKey()] = {
    recovery: clamp(
      Number($("#readiness-recovery").value) || 1,
      1,
      10
    ),

    fatigue: clamp(
      Number($("#readiness-fatigue").value) || 1,
      1,
      10
    ),

    pain: clamp(
      Number($("#readiness-pain").value) || 0,
      0,
      10
    ),

    updatedAt: new Date().toISOString()
  };

  saveState();
  closeModal();
  renderCurrentRoute();

  showToast(
    "Readiness aktualisiert."
  );
}


function saveWorkout() {
  const duration =
    Math.max(
      1,
      Number(
        $("#workout-duration").value
      ) || 1
    );

  const rpe =
    clamp(
      Number(
        $("#workout-rpe").value
      ) || 1,
      1,
      10
    );

  const pain =
    clamp(
      Number(
        $("#workout-pain").value
      ) || 0,
      0,
      10
    );

  const workout = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()),

    date:
      new Date().toISOString(),

    title:
      getRecommendation().title,

    type:
      getRecommendation().type,

    duration,

    rpe,

    pain,

    note:
      $("#workout-note").value.trim(),

    exercises:
      getRecommendation().exercises
  };

  state.workouts.push(workout);

  saveState();
  closeModal();
  renderCurrentRoute();

  if (pain >= 5) {
    showToast(
      "Training gespeichert. Hoher Schmerz erkannt – nächste Belastung wird angepasst."
    );
  } else {
    showToast(
      "Stark. Training wurde gespeichert."
    );
  }
}


function saveFootball() {
  const duration =
    Math.max(
      1,
      Number(
        $("#football-duration").value
      ) || 1
    );

  const rpe =
    clamp(
      Number(
        $("#football-rpe").value
      ) || 1,
      1,
      10
    );

  const pain =
    clamp(
      Number(
        $("#football-pain").value
      ) || 0,
      0,
      10
    );

  state.footballSessions.push({
    id:
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()),

    date:
      new Date().toISOString(),

    type:
      $("#football-type").value,

    duration,
    rpe,
    pain,

    note:
      $("#football-note").value.trim()
  });

  saveState();
  closeModal();
  renderCurrentRoute();

  showToast(
    "Fußballbelastung gespeichert."
  );
}


function completeRecovery() {
  state.workouts.push({
    id:
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()),

    date:
      new Date().toISOString(),

    title:
      "Aktive Regeneration",

    type:
      "recovery",

    duration: 20,

    rpe: 2,

    pain:
      getTodayReadiness().pain,

    note:
      "Regeneration"
  });

  saveState();
  closeModal();
  renderCurrentRoute();

  showToast(
    "Regeneration gespeichert."
  );
}


function saveNutrition() {
  state.nutrition[todayKey()] = {
    calories:
      Math.max(
        0,
        Number(
          $("#nutrition-calories").value
        ) || 0
      ),

    protein:
      Math.max(
        0,
        Number(
          $("#nutrition-protein").value
        ) || 0
      ),

    carbs:
      Math.max(
        0,
        Number(
          $("#nutrition-carbs").value
        ) || 0
      ),

    fat:
      Math.max(
        0,
        Number(
          $("#nutrition-fat").value
        ) || 0
      ),

    updatedAt:
      new Date().toISOString()
  };

  saveState();
  closeModal();
  renderCurrentRoute();

  showToast(
    "Ernährung gespeichert."
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function navigate(route) {
  state.settings.route = route;

  saveState();

  renderCurrentRoute();
}


function renderCurrentRoute() {
  const route =
    state.settings.route || "today";

  $$(".nav-item").forEach(
    (item) => {
      item.classList.toggle(
        "active",
        item.dataset.route === route
      );
    }
  );

  switch (route) {
    case "training":
      renderTraining();
      break;

    case "week":
      renderWeek();
      break;

    case "progress":
      renderProgress();
      break;

    case "nutrition":
      renderNutrition();
      break;

    default:
      renderToday();
  }
}


/* =========================================================
   MODAL
   ========================================================= */

function closeModal() {
  $("#modal-root").innerHTML = "";
}


/* =========================================================
   PROFILE
   ========================================================= */

function openProfile() {
  $("#modal-root").innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-header">

          <h2 class="modal-title">
            Profil
          </h2>

          <button
            class="close-button"
            data-action="close-modal"
            type="button"
          >
            ×
          </button>

        </div>


        <div class="form-group">

          <label class="form-label">
            Name
          </label>

          <input
            id="profile-name"
            class="input"
            value="${state.user.name}"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Gewicht in kg
          </label>

          <input
            id="profile-weight"
            class="input"
            type="number"
            value="${state.user.weight}"
          >

        </div>


        <div class="form-group">

          <label class="form-label">
            Körperfett optional
          </label>

          <input
            id="profile-bodyfat"
            class="input"
            placeholder="z. B. 17 %"
            value="${state.user.bodyFat}"
          >

        </div>


        <button
          class="primary-button"
          data-action="save-profile"
          type="button"
        >
          PROFIL SPEICHERN
        </button>

      </div>

    </div>
  `;
}


function saveProfile() {
  state.user.name =
    $("#profile-name").value.trim() ||
    "Dominik";

  state.user.weight =
    Number(
      $("#profile-weight").value
    ) ||
    state.user.weight;

  state.user.bodyFat =
    $("#profile-bodyfat").value.trim();

  saveState();
  closeModal();
  renderCurrentRoute();

  showToast(
    "Profil gespeichert."
  );
}


/* =========================================================
   EVENT HANDLING
   ========================================================= */

document.addEventListener(
  "click",
  (event) => {

    const routeButton =
      event.target.closest(
        "[data-route]"
      );

    if (routeButton) {
      navigate(
        routeButton.dataset.route
      );

      return;
    }


    const actionButton =
      event.target.closest(
        "[data-action]"
      );

    if (!actionButton) return;

    const action =
      actionButton.dataset.action;


    switch (action) {

      case "readiness":
        openReadinessModal();
        break;

      case "save-readiness":
        saveReadiness();
        break;

      case "start-workout":
        startWorkout();
        break;

      case "save-workout":
        saveWorkout();
        break;

      case "save-football":
        saveFootball();
        break;

      case "complete-recovery":
        completeRecovery();
        break;

      case "nutrition-log":
        openNutritionModal();
        break;

      case "save-nutrition":
        saveNutrition();
        break;

      case "open-settings":
        openProfile();
        break;

      case "save-profile":
        saveProfile();
        break;

      case "close-modal":
        closeModal();
        break;

      default:
        break;
    }
  }
);


/* =========================================================
   KEYBOARD
   ========================================================= */

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

function init() {

  /*
    Initial default readiness.
    Damit funktioniert die App auch beim
    allerersten Öffnen ohne Eingabe.
  */

  if (!state.readiness[todayKey()]) {
    state.readiness[todayKey()] = {
      recovery: 7,
      fatigue: 3,
      pain: 0,
      updatedAt: new Date().toISOString()
    };

    saveState();
  }


  renderCurrentRoute();


  /*
    Service Worker wird später aktiviert,
    sobald service-worker.js existiert.
  */

  if (
    "serviceWorker" in navigator &&
    window.location.protocol !== "file:"
  ) {
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker
          .register("./service-worker.js")
          .catch((error) => {
            console.warn(
              "Service Worker noch nicht verfügbar:",
              error
            );
          });
      }
    );
  }
}


init();