import { sampleRecipes } from "./sampleData.js?v=20260709";
import { buildMealOptions, buildPlan } from "./planning/weeklyPlanner.js?v=20260709";
import { splitShoppingList } from "./planning/shoppingSplitter.js?v=20260724";

const dinnerDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Next Monday",
];

const storageKeys = {
  dayNotes: "menuGenerator.dayNotes",
  dayDishes: "menuGenerator.dayDishes",
  lockedDays: "menuGenerator.lockedDays",
  recipeFeedback: "menuGenerator.recipeFeedback",
  cookingHistory: "menuGenerator.cookingHistory",
  currentPlan: "menuGenerator.currentPlan",
  selectedWeekStart: "menuGenerator.selectedWeekStart",
  weekDrafts: "menuGenerator.weekDrafts",
  savedWeeks: "menuGenerator.savedWeeks",
  shoppingDays: "menuGenerator.shoppingDays",
  manualShoppingItems: "menuGenerator.manualShoppingItems",
};
const apiBase = location.protocol === "file:" ? "http://127.0.0.1:5178/api" : "/api";
const preWeekShop = "Pre-week shop";

const dishRoles = ["appetizer", "side", "salad", "vegetable", "carb", "protein", "other"];
const suggestionRoles = ["appetizer", "salad", "vegetable", "carb", "protein", "side"];

const state = {
  inspiration: "none",
  weekMood: "balanced",
  busyDays: new Set(["Monday", "Tuesday", "Wednesday"]),
  noCookDays: new Set(),
  lunchDays: new Set(),
  snackDessertDays: new Set(["Friday", "Saturday", "Sunday"]),
  shoppingDays: new Set(loadArray(storageKeys.shoppingDays).length ? loadArray(storageKeys.shoppingDays) : ["Tuesday", "Saturday"]),
  recipes: sampleRecipes,
  plan: null,
  selectedWeekStart: localStorage.getItem(storageKeys.selectedWeekStart) || getDefaultPlanningWeekStartKey(),
  weekDrafts: loadObject(storageKeys.weekDrafts),
  dayNotes: loadObject(storageKeys.dayNotes),
  dayDishes: loadObject(storageKeys.dayDishes),
  lockedDays: new Set(loadArray(storageKeys.lockedDays)),
  recipeFeedback: loadObject(storageKeys.recipeFeedback),
  cookingHistory: loadObject(storageKeys.cookingHistory),
  savedPlan: loadObject(storageKeys.currentPlan),
  savedWeeks: loadArray(storageKeys.savedWeeks),
  manualShoppingItems: loadObject(storageKeys.manualShoppingItems),
  activeSavedWeekId: "",
  recentlyLoadedSavedWeekId: "",
  loadedFeedbackTimer: null,
  excludedRecipeIdsBySlot: new Map(),
  excludedAddOnSuggestionIdsBySlot: new Map(),
  addOnSuggestionIdsBySlot: new Map(),
  removedShoppingItemIds: new Set(),
  shoppingItemAssignments: new Map(),
  collapsedShoppingGroups: new Set(),
  activeBringItemId: "",
  bringItemDrafts: {},
  bringItemStatus: {},
  activeAdders: {},
  activeMealChoosers: new Set(),
  visibleMealOptions: new Set(),
  activeView: "plan",
  recipeSearch: "",
  recipeFilter: "all",
  selectedRecipeId: null,
  openRecipeDetails: new Set(),
  openPlanReviewSections: new Set(),
  importFiles: [],
  selectedImportFiles: new Set(),
  importStatus: "",
  importBusy: false,
};

const controls = {
  planView: document.querySelector("#planView"),
  shoppingView: document.querySelector("#shoppingView"),
  recipesView: document.querySelector("#recipesView"),
  historyView: document.querySelector("#historyView"),
  importView: document.querySelector("#importView"),
  viewTabs: document.querySelectorAll("[data-view-tab]"),
  inspiration: document.querySelector("#inspiration"),
  weekMood: document.querySelector("#weekMood"),
  previousWeekButton: document.querySelector("#previousWeekButton"),
  nextWeekButton: document.querySelector("#nextWeekButton"),
  currentWeekButton: document.querySelector("#currentWeekButton"),
  planningWeekName: document.querySelector("#planningWeekName"),
  planningWeekRange: document.querySelector("#planningWeekRange"),
  busyDays: document.querySelector("#busyDays"),
  noCookDays: document.querySelector("#noCookDays"),
  lunchDays: document.querySelector("#lunchDays"),
  snackDessertDays: document.querySelector("#snackDessertDays"),
  shoppingDays: document.querySelector("#shoppingDays"),
  startFreshWeekButton: document.querySelector("#startFreshWeekButton"),
  saveWeekButton: document.querySelector("#saveWeekButton"),
  savedWeeksList: document.querySelector("#savedWeeksList"),
  planningWeekLabel: document.querySelector("#planningWeekLabel"),
  menuPlan: document.querySelector("#menuPlan"),
  shoppingList: document.querySelector("#shoppingList"),
  recipeLibrarySearch: document.querySelector("#recipeLibrarySearch"),
  recipeLibraryFilter: document.querySelector("#recipeLibraryFilter"),
  recipeLibraryCount: document.querySelector("#recipeLibraryCount"),
  recipeLibraryList: document.querySelector("#recipeLibraryList"),
  recipeLibraryDetail: document.querySelector("#recipeLibraryDetail"),
  importFileList: document.querySelector("#importFileList"),
  importButton: document.querySelector("#importButton"),
  importStatus: document.querySelector("#importStatus"),
  quickRecipeOverlay: document.querySelector("#quickRecipeOverlay"),
  quickRecipeTitle: document.querySelector("#quickRecipeTitle"),
  quickRecipeContent: document.querySelector("#quickRecipeContent"),
  closeQuickRecipeOverlay: document.querySelector("#closeQuickRecipeOverlay"),
  sourceOverlay: document.querySelector("#sourceOverlay"),
  sourceFrame: document.querySelector("#sourceFrame"),
  sourceDialogTitle: document.querySelector("#sourceDialogTitle"),
  sourceExternalLink: document.querySelector("#sourceExternalLink"),
  closeSourceOverlay: document.querySelector("#closeSourceOverlay"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function formatShoppingDayLabel(day) {
  return day === preWeekShop ? "Before this week" : day;
}

function getRecipeDisplayTitle(recipe) {
  if (!recipe) return "";
  return state.recipeFeedback[recipe.id]?.displayTitle?.trim() || recipe.title;
}

function isRecipeHidden(recipe) {
  if (!recipe) return false;
  return state.recipeFeedback[recipe.id]?.hiddenFromPlanner === true;
}

function loadObject(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? {};
  } catch {
    return {};
  }
}

function loadArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveObject(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  saveSharedState();
}

function getSharedStatePayload() {
  return {
    [storageKeys.dayNotes]: state.dayNotes,
    [storageKeys.dayDishes]: state.dayDishes,
    [storageKeys.lockedDays]: [...state.lockedDays],
    [storageKeys.recipeFeedback]: state.recipeFeedback,
    [storageKeys.cookingHistory]: state.cookingHistory,
    [storageKeys.currentPlan]: serializePlan(state.plan) ?? state.savedPlan,
    [storageKeys.selectedWeekStart]: state.selectedWeekStart,
    [storageKeys.weekDrafts]: state.weekDrafts,
    [storageKeys.savedWeeks]: state.savedWeeks,
    [storageKeys.shoppingDays]: [...state.shoppingDays],
    [storageKeys.manualShoppingItems]: state.manualShoppingItems,
  };
}

async function loadSharedState() {
  try {
    const response = await fetch(`${apiBase}/state`, { cache: "no-store" });
    if (!response.ok) return;

    const sharedState = await response.json();
    const sharedFeedback = sharedState[storageKeys.recipeFeedback] ?? {};
    const sharedDayNotes = sharedState[storageKeys.dayNotes] ?? {};
    const sharedDayDishes = sharedState[storageKeys.dayDishes] ?? {};
    const sharedLockedDays = Array.isArray(sharedState[storageKeys.lockedDays])
      ? sharedState[storageKeys.lockedDays]
      : [];
    const sharedCookingHistory = sharedState[storageKeys.cookingHistory] ?? {};
    const sharedPlan = sharedState[storageKeys.currentPlan] ?? null;
    const sharedSelectedWeekStart = sharedState[storageKeys.selectedWeekStart] ?? "";
    const sharedWeekDrafts = sharedState[storageKeys.weekDrafts] ?? {};
    const sharedSavedWeeks = Array.isArray(sharedState[storageKeys.savedWeeks])
      ? sharedState[storageKeys.savedWeeks]
      : [];
    const sharedShoppingDays = Array.isArray(sharedState[storageKeys.shoppingDays])
      ? sharedState[storageKeys.shoppingDays]
      : [];
    const sharedManualShoppingItems = sharedState[storageKeys.manualShoppingItems] ?? {};

    state.recipeFeedback = { ...sharedFeedback, ...state.recipeFeedback };
    state.dayNotes = { ...sharedDayNotes, ...state.dayNotes };
    state.dayDishes = { ...sharedDayDishes, ...state.dayDishes };
    state.manualShoppingItems = { ...sharedManualShoppingItems, ...state.manualShoppingItems };
    state.lockedDays = new Set([...sharedLockedDays, ...state.lockedDays]);
    state.cookingHistory = sharedCookingHistory;
    if (sharedShoppingDays.length) state.shoppingDays = new Set(sharedShoppingDays);
    if (sharedSelectedWeekStart) state.selectedWeekStart = localStorage.getItem(storageKeys.selectedWeekStart) || sharedSelectedWeekStart;
    state.weekDrafts = mergeWeekDrafts(sharedWeekDrafts, state.weekDrafts);
    if (sharedPlan) state.savedPlan = sharedPlan;
    state.savedWeeks = mergeSavedWeeks(sharedSavedWeeks, state.savedWeeks);

    localStorage.setItem(storageKeys.recipeFeedback, JSON.stringify(state.recipeFeedback));
    localStorage.setItem(storageKeys.dayNotes, JSON.stringify(state.dayNotes));
    localStorage.setItem(storageKeys.dayDishes, JSON.stringify(state.dayDishes));
    localStorage.setItem(storageKeys.lockedDays, JSON.stringify([...state.lockedDays]));
    localStorage.setItem(storageKeys.cookingHistory, JSON.stringify(state.cookingHistory));
    localStorage.setItem(storageKeys.currentPlan, JSON.stringify(state.savedPlan));
    localStorage.setItem(storageKeys.selectedWeekStart, state.selectedWeekStart);
    localStorage.setItem(storageKeys.weekDrafts, JSON.stringify(state.weekDrafts));
    localStorage.setItem(storageKeys.savedWeeks, JSON.stringify(state.savedWeeks));
    localStorage.setItem(storageKeys.shoppingDays, JSON.stringify([...state.shoppingDays]));
    localStorage.setItem(storageKeys.manualShoppingItems, JSON.stringify(state.manualShoppingItems));
    saveSharedState();
  } catch {
    // Static file mode still works without the local server.
  }
}

let sharedStateSaveTimer = null;

function saveSharedState() {
  if (sharedStateSaveTimer) clearTimeout(sharedStateSaveTimer);
  sharedStateSaveTimer = setTimeout(() => {
    fetch(`${apiBase}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getSharedStatePayload()),
    }).catch(() => {
      // Local browser storage remains the fallback if the server is unavailable.
    });
  }, 150);
}

function serializePlan(plan) {
  if (!plan?.days) return null;

  const recipeId = (recipe) => recipe?.id ?? null;
  const recipeIds = (recipes = []) => recipes.map((recipe) => recipe.id);

  return {
    days: plan.days.map((day) => ({
      label: day.label,
      busy: day.busy,
      noDinner: day.noDinner,
      noCook: day.noCook,
      snackDessertNeeded: day.snackDessertNeeded,
      reason: day.reason,
      carriedFromPreviousWeek: Boolean(day.carriedFromPreviousWeek),
      dinnerId: recipeId(day.dinner),
      dinnerOptionIds: recipeIds(day.dinnerOptions),
      sideId: recipeId(day.side),
      lunchId: recipeId(day.lunch),
      lunchOptionIds: recipeIds(day.lunchOptions),
      snackDessertId: recipeId(day.snackDessert),
      snackDessertOptionIds: recipeIds(day.snackDessertOptions),
      customLunch: day.customLunch ?? null,
      customDinner: day.customDinner ?? null,
      customSnackDessert: day.customSnackDessert ?? null,
    })),
  };
}

function hydratePlan(savedPlan) {
  if (!savedPlan?.days?.length) return null;

  const recipesById = new Map(state.recipes.map((recipe) => [recipe.id, recipe]));
  const recipe = (id) => recipesById.get(id) ?? null;
  const recipes = (ids = []) => ids.map((id) => recipe(id)).filter(Boolean);

  return {
    days: savedPlan.days.map((day) => ({
      label: day.label,
      busy: Boolean(day.busy),
      noDinner: Boolean(day.noDinner),
      noCook: Boolean(day.noCook),
      snackDessertNeeded: Boolean(day.snackDessertNeeded),
      reason: day.reason ?? "",
      carriedFromPreviousWeek: Boolean(day.carriedFromPreviousWeek),
      dinner: recipe(day.dinnerId),
      dinnerOptions: recipes(day.dinnerOptionIds),
      side: recipe(day.sideId),
      lunch: recipe(day.lunchId),
      lunchOptions: recipes(day.lunchOptionIds),
      snackDessert: recipe(day.snackDessertId),
      snackDessertOptions: recipes(day.snackDessertOptionIds),
      customLunch: day.customLunch ?? null,
      customDinner: day.customDinner ?? null,
      customSnackDessert: day.customSnackDessert ?? null,
    })),
  };
}

function saveCurrentPlan() {
  if (!state.plan) return;

  state.savedPlan = serializePlan(state.plan);
  localStorage.setItem(storageKeys.currentPlan, JSON.stringify(state.savedPlan));
  saveCurrentWeekDraft();
  saveSharedState();
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function mergeSavedWeeks(...weekLists) {
  const byId = new Map();

  weekLists.flat().forEach((week) => {
    if (!week?.id) return;
    byId.set(week.id, week);
  });

  return [...byId.values()].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

function mergeWeekDrafts(...draftObjects) {
  const drafts = {};

  draftObjects.forEach((draftObject) => {
    Object.entries(draftObject ?? {}).forEach(([weekStart, draft]) => {
      if (!draft?.weekStart && !weekStart) return;
      const key = draft.weekStart ?? weekStart;
      const existing = drafts[key];
      if (!existing || String(draft.updatedAt ?? "").localeCompare(String(existing.updatedAt ?? "")) >= 0) {
        drafts[key] = { ...draft, weekStart: key };
      }
    });
  });

  return drafts;
}

function saveCurrentWeekDraft() {
  if (!state.selectedWeekStart || !state.plan) return;

  state.weekDrafts[state.selectedWeekStart] = {
    weekStart: state.selectedWeekStart,
    updatedAt: new Date().toISOString(),
    plan: serializePlan(state.plan),
    dayDishes: cloneJson(state.dayDishes) ?? {},
    dayNotes: cloneJson(state.dayNotes) ?? {},
    manualShoppingItems: cloneJson(state.manualShoppingItems) ?? {},
    lockedDays: [...state.lockedDays],
    busyDays: [...state.busyDays],
    noCookDays: [...state.noCookDays],
    lunchDays: [...state.lunchDays],
    snackDessertDays: [...state.snackDessertDays],
    inspiration: state.inspiration,
    weekMood: state.weekMood,
  };
  localStorage.setItem(storageKeys.weekDrafts, JSON.stringify(state.weekDrafts));
  localStorage.setItem(storageKeys.selectedWeekStart, state.selectedWeekStart);
}

function saveSavedWeeks() {
  localStorage.setItem(storageKeys.savedWeeks, JSON.stringify(state.savedWeeks));
  saveSharedState();
}

function getPlanningWeekRangeLabel() {
  const start = getPlanningWeekStartDate();
  const end = getPlannedDateObject("Next Monday");
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function saveWeekSnapshot() {
  if (!state.plan) return;

  const savedAt = new Date().toISOString();
  const week = {
    id: `week-${savedAt}`,
    savedAt,
    weekStart: state.selectedWeekStart,
    weekLabel: getPlanningWeekRangeLabel(),
    plan: serializePlan(state.plan),
    dayDishes: cloneJson(state.dayDishes) ?? {},
    dayNotes: cloneJson(state.dayNotes) ?? {},
    manualShoppingItems: cloneJson(state.manualShoppingItems) ?? {},
    lockedDays: [...state.lockedDays],
  };

  state.savedWeeks = mergeSavedWeeks([week], state.savedWeeks);
  state.activeSavedWeekId = week.id;
  saveSavedWeeks();
  renderSavedWeeksList();
}

function restoreSavedWeek(weekId) {
  const week = state.savedWeeks.find((candidate) => candidate.id === weekId);
  if (!week) return;

  const restoredPlan = hydratePlan(week.plan);
  if (!restoredPlan) return;

  state.plan = restoredPlan;
  state.dayDishes = cloneJson(week.dayDishes) ?? {};
  state.dayNotes = cloneJson(week.dayNotes) ?? {};
  state.manualShoppingItems = cloneJson(week.manualShoppingItems) ?? {};
  state.lockedDays = new Set();
  localStorage.setItem(storageKeys.dayDishes, JSON.stringify(state.dayDishes));
  localStorage.setItem(storageKeys.dayNotes, JSON.stringify(state.dayNotes));
  localStorage.setItem(storageKeys.manualShoppingItems, JSON.stringify(state.manualShoppingItems));
  localStorage.setItem(storageKeys.lockedDays, JSON.stringify([...state.lockedDays]));
  saveCurrentPlan();
  renderPlanningToggles();
  renderPlan(state.plan);
  renderCurrentShoppingList();
  showSavedWeekLoadedFeedback(week.id);
  renderSavedWeeksList();
}

function showSavedWeekLoadedFeedback(weekId) {
  state.recentlyLoadedSavedWeekId = weekId;
  if (state.loadedFeedbackTimer) clearTimeout(state.loadedFeedbackTimer);
  state.loadedFeedbackTimer = setTimeout(() => {
    state.recentlyLoadedSavedWeekId = "";
    state.loadedFeedbackTimer = null;
    renderSavedWeeksList();
  }, 1500);
}

function showTemporaryButtonText(button, text, duration = 1500) {
  if (!button) return;
  const originalText = button.dataset.defaultText || button.textContent;
  button.dataset.defaultText = originalText;
  button.textContent = text;
  if (button.dataset.feedbackTimer) clearTimeout(Number(button.dataset.feedbackTimer));
  const timer = setTimeout(() => {
    button.textContent = button.dataset.defaultText;
    delete button.dataset.feedbackTimer;
  }, duration);
  button.dataset.feedbackTimer = String(timer);
}

function deleteSavedWeek(weekId) {
  state.savedWeeks = state.savedWeeks.filter((week) => week.id !== weekId);
  if (state.activeSavedWeekId === weekId) state.activeSavedWeekId = "";
  saveSavedWeeks();
  renderSavedWeeksList();
}

function formatSavedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSavedWeekDishes(day, week) {
  const dishes = [];
  const weekDishes = week.dayDishes?.[day.label] ?? [];

  const add = (role, title) => {
    if (title) dishes.push({ role, title });
  };

  add(day.customLunch ? "lunch" : "lunch idea", day.customLunch || (day.lunch ? getRecipeDisplayTitle(day.lunch) : ""));
  weekDishes
    .filter((dish) => dish.mealType === "lunch")
    .forEach((dish) => add(`lunch ${dish.role}`, dish.title || getDishTitle(dish)));
  add(day.customSnackDessert ? "snack/dessert" : "snack/dessert idea", day.customSnackDessert || (day.snackDessert ? getRecipeDisplayTitle(day.snackDessert) : ""));
  add(day.customDinner ? "dinner" : "dinner idea", day.customDinner || (day.dinner ? getRecipeDisplayTitle(day.dinner) : ""));
  if (!day.customDinner && day.side) add("side", getRecipeDisplayTitle(day.side));
  weekDishes
    .filter((dish) => (dish.mealType ?? "dinner") === "dinner")
    .forEach((dish) => add(dish.role, dish.title || getDishTitle(dish)));

  return dishes;
}

function renderSavedWeekDetails(week) {
  const plan = hydratePlan(week.plan);
  if (!plan) return `<p class="saved-week-empty">Some recipes from this saved week are no longer available.</p>`;

  return `
    <div class="saved-week-details">
      ${plan.days.map((day) => {
        const dishes = getSavedWeekDishes(day, week);
        return `
          <div class="saved-week-day">
            <strong>${escapeHtml(day.label)}</strong>
            ${dishes.length
              ? `<ul>${dishes.map((dish) => `<li><span>${escapeHtml(dish.role)}</span>${escapeHtml(dish.title)}</li>`).join("")}</ul>`
              : `<p>No meals planned</p>`}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderSavedWeeksList() {
  if (!controls.savedWeeksList) return;

  controls.savedWeeksList.innerHTML = state.savedWeeks.length
    ? state.savedWeeks.map((week) => `
        <article class="saved-week">
          <div class="saved-week-header">
            <div>
              <strong>${escapeHtml(week.weekLabel ?? "Saved week")}</strong>
              <p>Saved ${escapeHtml(formatSavedAt(week.savedAt))}</p>
            </div>
            <div class="saved-week-actions">
              <button class="small-button" type="button" data-view-saved-week="${escapeHtml(week.id)}">
                ${state.activeSavedWeekId === week.id ? "Hide" : "View"}
              </button>
              <button class="small-button" type="button" data-restore-saved-week="${escapeHtml(week.id)}">
                ${state.recentlyLoadedSavedWeekId === week.id ? "Loaded" : "Reuse for this week"}
              </button>
              <button class="remove-button" type="button" data-delete-saved-week="${escapeHtml(week.id)}">Delete</button>
            </div>
          </div>
          ${state.activeSavedWeekId === week.id ? renderSavedWeekDetails(week) : ""}
        </article>
      `).join("")
    : `<p class="saved-week-empty">No saved weeks yet.</p>`;

  controls.savedWeeksList.querySelectorAll("[data-view-saved-week]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeSavedWeekId = state.activeSavedWeekId === button.dataset.viewSavedWeek ? "" : button.dataset.viewSavedWeek;
      renderSavedWeeksList();
    });
  });

  controls.savedWeeksList.querySelectorAll("[data-restore-saved-week]").forEach((button) => {
    button.addEventListener("click", () => {
      restoreSavedWeek(button.dataset.restoreSavedWeek);
    });
  });

  controls.savedWeeksList.querySelectorAll("[data-delete-saved-week]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteSavedWeek(button.dataset.deleteSavedWeek);
    });
  });
}

function renderToggleGroup(container, days, selectedSet, onChange, lockedDays = new Set()) {
  container.innerHTML = "";

  days.forEach((day) => {
    const label = document.createElement("label");
    label.className = "toggle-pill";
    if (lockedDays.has(day)) label.classList.add("is-locked");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selectedSet.has(day);
    input.disabled = lockedDays.has(day);
    input.addEventListener("change", () => {
      if (input.checked) selectedSet.add(day);
      else selectedSet.delete(day);
      onChange();
    });

    const span = document.createElement("span");
    span.textContent = day.replace("Next ", "Next ");

    label.append(input, span);
    container.append(label);
  });
}

function renderPlan(plan) {
  renderPlanningWeekLabel();
  renderPlanningWeekSwitcher();
  sanitizeAutomaticSides(plan);
  saveCurrentPlan();
  controls.menuPlan.innerHTML = "";

  plan.days.forEach((day) => {
    const article = document.createElement("article");
    article.className = "day-card";
    const isLocked = state.lockedDays.has(day.label);
    if (isLocked) article.classList.add("is-locked-day");

    if (day.noCook) {
      article.classList.add("is-no-cook");
      article.innerHTML = `
        <div class="day-card-header">
          <div>
            <h3>${escapeHtml(day.label)}</h3>
            <p>${escapeHtml(getPlannedDateLabel(day.label))}</p>
          </div>
          <span>${escapeHtml(getDayStatusLabel(day))}</span>
        </div>
        ${isLocked ? renderLockedSummary(day) : renderDayControls(day)}
      `;
      controls.menuPlan.append(article);
      return;
    }

    if (day.customDinner || day.customLunch) article.classList.add("is-custom-meal");

    const lunch = day.lunch || day.customLunch || day.lunchOptions?.length
      ? `
        <section class="meal-section">
          <div class="meal-section-title">Lunch</div>
          ${day.customLunch
            ? renderCustomMealRow(day, "lunch", day.customLunch)
            : renderMealOptions(day, "lunch", day.lunchOptions, day.lunch)}
          ${day.customLunch ? "" : renderMealBuilder(day, "lunch")}
        </section>
      `
      : "";
    const snackDessert = day.snackDessertNeeded || day.snackDessert || day.customSnackDessert
      ? `
        <section class="meal-section snack-dessert-section">
          <div class="meal-section-title">Snacks / Dessert</div>
          ${day.customSnackDessert
            ? renderCustomMealRow(day, "snackDessert", day.customSnackDessert)
            : day.snackDessert || day.snackDessertOptions?.length
              ? renderMealOptions(day, "snackDessert", day.snackDessertOptions, day.snackDessert)
              : renderOptionalMealRow("Choose or write something")}
        </section>
      `
      : "";
    const dinner = day.noDinner
      ? ""
      : `
        <section class="meal-section dinner-section">
          <div class="meal-section-title">Dinner</div>
          ${day.customDinner
            ? renderCustomMealRow(day, "dinner", day.customDinner)
            : renderMealOptions(day, "dinner", day.dinnerOptions, day.dinner)}
          ${day.customDinner ? "" : renderMealBuilder(day, "dinner")}
        </section>
      `;

    article.innerHTML = `
      <div class="day-card-header">
        <div>
          <h3>${escapeHtml(day.label)}</h3>
          <p>${escapeHtml(getPlannedDateLabel(day.label))}</p>
        </div>
        <span>${escapeHtml(getDayStatusLabel(day))}</span>
      </div>
      ${isLocked ? renderLockedSummary(day) : `
        ${lunch}
        ${dinner}
        ${snackDessert}
        ${renderDayControls(day)}
      `}
    `;

    controls.menuPlan.append(article);
  });

  controls.menuPlan.querySelectorAll("[data-regenerate-day]").forEach((button) => {
    button.addEventListener("click", () => {
      regenerateMeal(button.dataset.regenerateDay, button.dataset.regenerateMeal);
    });
  });

  controls.menuPlan.querySelectorAll("[data-select-meal-option]").forEach((button) => {
    button.addEventListener("click", () => {
      selectMealOption(
        button.dataset.selectMealOption,
        button.dataset.selectMealType,
        button.dataset.selectRecipeId,
      );
    });
  });

  controls.menuPlan.querySelectorAll("[data-toggle-meal-options]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleMealOptions(button.dataset.toggleMealOptions, button.dataset.toggleMeal);
    });
  });

  controls.menuPlan.querySelectorAll("[data-use-selected-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.closest(".recipe-picker")?.querySelector("[data-recipe-picker-input]");
      const recipeId = getRecipeIdFromPicker(input);
      selectRecipe(button.dataset.useSelectedRecipe, button.dataset.useMeal, recipeId);
    });
  });

  controls.menuPlan.querySelectorAll("[data-toggle-meal-chooser]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleMealChooser(button.dataset.toggleMealChooser, button.dataset.toggleMeal);
    });
  });

  controls.menuPlan.querySelectorAll("[data-recipe-search]").forEach((input) => {
    input.addEventListener("input", () => {
      filterRecipeOptions(input);
    });
  });

  controls.menuPlan.querySelectorAll("[data-recipe-picker-input]").forEach((input) => {
    input.addEventListener("input", () => {
      input.dataset.selectedRecipeId = "";
      renderRecipePickerResults(input);
    });
    input.addEventListener("focus", () => {
      renderRecipePickerResults(input);
    });
  });

  controls.menuPlan.querySelectorAll("[data-select-picker-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      selectRecipePickerResult(button);
    });
  });

  controls.menuPlan.querySelectorAll("[data-day-note]").forEach((input) => {
    input.addEventListener("blur", (event) => {
      if (input.closest(".manual-meal-fields")?.contains(event.relatedTarget)) return;
      setDayNote(input.dataset.dayNote, input.dataset.dayNoteMeal, input.value);
    });
  });

  controls.menuPlan.querySelectorAll("[data-day-shopping-items]").forEach((input) => {
    input.addEventListener("blur", (event) => {
      if (input.closest(".manual-meal-fields")?.contains(event.relatedTarget)) return;
      setManualShoppingItems(input.dataset.dayShoppingItems, input.dataset.dayShoppingMeal, input.value);
      const titleInput = input.closest(".manual-meal-fields")?.querySelector("[data-day-note]");
      if (titleInput) setDayNote(titleInput.dataset.dayNote, titleInput.dataset.dayNoteMeal, titleInput.value);
    });
  });

  controls.menuPlan.querySelectorAll("[data-lock-day]").forEach((input) => {
    input.addEventListener("change", () => {
      setDayLock(input.dataset.lockDay, input.checked);
    });
  });

  controls.menuPlan.querySelectorAll("[data-regenerate-day-only]").forEach((button) => {
    button.addEventListener("click", () => {
      regenerateDay(button.dataset.regenerateDayOnly);
    });
  });

  controls.menuPlan.querySelectorAll("[data-clear-note]").forEach((button) => {
    button.addEventListener("click", () => {
      setDayNote(button.dataset.clearNote, button.dataset.clearNoteMeal ?? "dinner", "");
    });
  });

  controls.menuPlan.querySelectorAll("[data-edit-manual-meal]").forEach((button) => {
    button.addEventListener("click", () => {
      openManualMealEdit(button.dataset.editManualMeal, button.dataset.editManualMealType);
    });
  });

  controls.menuPlan.querySelectorAll("[data-close-manual-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      closeManualMealEdit(button.dataset.closeManualEdit, button.dataset.closeManualEditMeal);
    });
  });

  controls.menuPlan.querySelectorAll("[data-review-status]").forEach((button) => {
    button.addEventListener("click", () => {
      setCookingHistoryStatus(button.dataset.reviewStatus, button.dataset.reviewKey);
    });
  });

  controls.menuPlan.querySelectorAll("[data-open-plan-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      openPlanRecipe(button.dataset.openPlanRecipe);
    });
  });

  controls.menuPlan.querySelectorAll("[data-plan-review-section]").forEach((details) => {
    details.addEventListener("toggle", () => {
      const sectionKey = details.dataset.planReviewSection;
      if (!sectionKey) return;
      if (details.open) state.openPlanReviewSections.add(sectionKey);
      else state.openPlanReviewSections.delete(sectionKey);
    });
  });

  controls.menuPlan.querySelectorAll("[data-feedback]").forEach((control) => {
    control.addEventListener("change", () => {
      updateRecipeFeedback(control);
    });
  });

  controls.menuPlan.querySelectorAll("[data-feedback-tag]").forEach((control) => {
    control.addEventListener("change", () => {
      updateRecipeMemoryTag(control);
    });
  });

  controls.menuPlan.querySelectorAll("[data-feedback-role]").forEach((control) => {
    control.addEventListener("change", () => {
      updateRecipeRole(control);
    });
  });

  controls.menuPlan.querySelectorAll("[data-feedback-addon-role]").forEach((control) => {
    control.addEventListener("change", () => {
      updateRecipeAddOnRole(control);
    });
  });

  controls.menuPlan.querySelectorAll("[data-open-add-role]").forEach((button) => {
    button.addEventListener("click", () => {
      openAddDishChooser(button.dataset.openAddRole, button.dataset.openAddMeal, button.dataset.openAddRoleValue);
    });
  });

  controls.menuPlan.querySelectorAll("[data-close-add-role]").forEach((button) => {
    button.addEventListener("click", () => {
      closeAddDishChooser(button.dataset.closeAddRole, button.dataset.closeAddMeal);
    });
  });

  controls.menuPlan.querySelectorAll("[data-remove-dish]").forEach((button) => {
    button.addEventListener("click", () => {
      removeDish(button.dataset.removeDishDay, button.dataset.removeDish);
    });
  });

  controls.menuPlan.querySelectorAll("[data-remove-auto-side]").forEach((button) => {
    button.addEventListener("click", () => {
      removeAutomaticSide(button.dataset.removeAutoSide);
    });
  });

  controls.menuPlan.querySelectorAll("[data-addon-recipe-search]").forEach((input) => {
    input.addEventListener("input", () => {
      input.dataset.selectedRecipeId = "";
      renderAddOnRecipeResults(input);
    });
    input.addEventListener("focus", () => {
      renderAddOnRecipeResults(input);
    });
  });

  controls.menuPlan.querySelectorAll("[data-add-suggested-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      addRecipeDish(button.dataset.addSuggestedRecipe, button.dataset.addMeal, button.dataset.addRole, button.dataset.addRecipeId);
    });
  });

  controls.menuPlan.querySelectorAll("[data-regenerate-addon-suggestions]").forEach((button) => {
    button.addEventListener("click", () => {
      regenerateAddOnSuggestions(button.dataset.regenerateAddonSuggestions, button.dataset.addMeal, button.dataset.addRole);
    });
  });

  controls.menuPlan.querySelectorAll("[data-add-selected-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.closest(".add-dish-chooser")?.querySelector("[data-addon-recipe-search]");
      const recipeId = getAddOnRecipeIdFromPicker(input);
      addRecipeDish(button.dataset.addSelectedRecipe, button.dataset.addMeal, button.dataset.addRole, recipeId);
    });
  });

  controls.menuPlan.querySelectorAll("[data-add-quick-dish]").forEach((button) => {
    button.addEventListener("click", () => {
      addManualDish(button.dataset.addQuickDish, button.dataset.addMeal, button.dataset.addRole, button.dataset.addTitle);
    });
  });

  controls.menuPlan.querySelectorAll("[data-add-manual-dish]").forEach((button) => {
    button.addEventListener("click", () => {
      const title = button.closest(".add-dish-chooser")?.querySelector("[data-custom-title]")?.value.trim();
      const shoppingItems = button.closest(".add-dish-chooser")?.querySelector("[data-custom-shopping-items]")?.value.trim();
      addManualDish(button.dataset.addManualDish, button.dataset.addMeal, button.dataset.addRole, title, shoppingItems);
    });
  });
}

function renderCustomMealRow(day, mealType, title) {
  const isEditing = state.activeMealChoosers.has(getMealKey(day.label, mealType));

  return `
    <div class="meal-row">
      <span>Chosen</span>
      <strong>${escapeHtml(title)}</strong>
      <div class="meal-row-actions">
        <button class="small-button" type="button" data-edit-manual-meal="${escapeHtml(day.label)}" data-edit-manual-meal-type="${mealType}">${isEditing ? "Editing" : "Edit"}</button>
        <button class="small-button" type="button" data-clear-note="${escapeHtml(day.label)}" data-clear-note-meal="${mealType}">Use recipe instead</button>
      </div>
    </div>
    ${isEditing ? `
      <div class="manual-meal-editor">
        ${renderMealNoteInput(day, mealType)}
        <button class="small-button" type="button" data-close-manual-edit="${escapeHtml(day.label)}" data-close-manual-edit-meal="${mealType}">Done</button>
      </div>
    ` : ""}
  `;
}

function renderOptionalMealRow(title) {
  return `
    <div class="meal-row">
      <span>Optional</span>
      <strong>${escapeHtml(title)}</strong>
    </div>
  `;
}

function renderMealOptions(day, mealType, options = [], selectedRecipe) {
  const optionList = (options.length ? options : selectedRecipe ? [selectedRecipe] : [])
    .filter((recipe) => recipe.id !== selectedRecipe?.id);
  const optionsKey = getMealKey(day.label, mealType);
  const showOptions = !selectedRecipe || state.visibleMealOptions.has(optionsKey);

  return `
    <div class="meal-options">
      ${selectedRecipe ? `
        <div class="chosen-meal">
          <span>Chosen</span>
          <strong>${escapeHtml(getRecipeDisplayTitle(selectedRecipe))}</strong>
          ${renderRecipeTimeFlags(selectedRecipe)}
          ${renderRecipeDetails(selectedRecipe, { rememberOpenState: false })}
        </div>
        <button
          class="small-button show-options-button"
          type="button"
          data-toggle-meal-options="${escapeHtml(day.label)}"
          data-toggle-meal="${mealType}"
        >
          ${showOptions ? "Done editing" : "Edit entry"}
        </button>
      ` : ""}
      ${showOptions ? `
        <div class="meal-options-heading">
          <span>Use an idea</span>
          <button class="small-button" type="button" data-regenerate-day="${escapeHtml(day.label)}" data-regenerate-meal="${mealType}">Regenerate ideas</button>
        </div>
        ${optionList.length ? `
          <div class="meal-option-list">
            ${optionList.map((recipe) => `
              <div class="meal-option-card">
                <button
                  class="meal-option"
                  type="button"
                  data-select-meal-option="${escapeHtml(day.label)}"
                  data-select-meal-type="${mealType}"
                  data-select-recipe-id="${escapeHtml(recipe.id)}"
                >
                  <span>Choose</span>
                  <strong>${escapeHtml(getRecipeDisplayTitle(recipe))}</strong>
                  ${renderRecipeTimeFlags(recipe)}
                </button>
                ${renderRecipeDetails(recipe, { rememberOpenState: false })}
              </div>
            `).join("")}
          </div>
        ` : `<p class="empty-suggestions">Regenerate for more ideas.</p>`}
        ${renderAlternateMealChooser(day, mealType)}
      ` : ""}
    </div>
  `;
}

function renderAlternateMealChooser(day, mealType) {
  const mealKey = getMealKey(day.label, mealType);
  const isOpen = state.activeMealChoosers.has(mealKey);

  return `
    <div class="meal-actions ${isOpen ? "is-open" : ""}">
      <button
        class="secondary-button compact-choice-button"
        type="button"
        data-toggle-meal-chooser="${escapeHtml(day.label)}"
        data-toggle-meal="${mealType}"
      >
        ${isOpen ? "Hide manual entry" : "Manual entry"}
      </button>
      ${isOpen ? `
        <div class="alternate-choice-panel">
          ${renderRecipePicker(day, mealType)}
          ${renderMealNoteInput(day, mealType)}
        </div>
      ` : ""}
    </div>
  `;
}

function renderRecipeTimeFlags(recipe) {
  const tags = getEffectiveTags(recipe);
  const flags = [
    tags.has("startEarly") ? "Start early" : null,
    tags.has("handsOn") ? "Hands-on" : null,
  ].filter(Boolean);

  if (!flags.length) return "";

  return `
    <div class="recipe-time-flags">
      ${flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")}
    </div>
  `;
}

function renderRecipeDetails(recipe, { rememberOpenState = true } = {}) {
  const times = [
    recipe.prepTime ? `Prep: ${recipe.prepTime}` : null,
    recipe.cookTime ? `Cook: ${recipe.cookTime}` : null,
    recipe.totalTime ? `Total: ${recipe.totalTime}` : null,
  ].filter(Boolean);
  const ingredients = recipe.ingredients ?? [];
  const directions = recipe.directions?.trim();

  return `
    <details class="recipe-details" data-recipe-details="${escapeHtml(recipe.id)}" ${rememberOpenState && state.openRecipeDetails.has(recipe.id) ? "open" : ""}>
      <summary>Recipe details</summary>
      <div class="recipe-details-body">
        ${times.length || recipe.servings ? `
          <div class="recipe-detail-meta">
            ${recipe.servings ? `<span>Serves: ${escapeHtml(recipe.servings)}</span>` : ""}
            ${times.map((time) => `<span>${escapeHtml(time)}</span>`).join("")}
          </div>
        ` : ""}
        ${ingredients.length ? `
          <div class="recipe-detail-section">
            <span>Ingredients</span>
            <ul>
              ${ingredients.map((ingredient) => `<li>${escapeHtml(ingredient)}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
        ${directions ? `
          <div class="recipe-detail-section">
            <span>Directions</span>
            <p>${escapeHtml(directions)}</p>
          </div>
        ` : ""}
        ${recipe.sourceUrl ? `
          <div class="source-actions">
            <button
              class="small-button"
              type="button"
              data-view-source-url="${escapeHtml(recipe.sourceUrl)}"
              data-view-source-title="${escapeHtml(getRecipeDisplayTitle(recipe))}"
            >
              View source
            </button>
          </div>
        ` : ""}
      </div>
    </details>
  `;
}

function renderQuickRecipeDetails(recipe) {
  const times = [
    recipe.prepTime ? `Prep: ${recipe.prepTime}` : null,
    recipe.cookTime ? `Cook: ${recipe.cookTime}` : null,
    recipe.totalTime ? `Total: ${recipe.totalTime}` : null,
  ].filter(Boolean);
  const ingredients = recipe.ingredients ?? [];
  const directions = recipe.directions?.trim();

  return `
    <section class="recipe-details quick-recipe-details">
      <div class="recipe-details-body">
        ${times.length || recipe.servings ? `
          <div class="recipe-detail-meta">
            ${recipe.servings ? `<span>Serves: ${escapeHtml(recipe.servings)}</span>` : ""}
            ${times.map((time) => `<span>${escapeHtml(time)}</span>`).join("")}
          </div>
        ` : ""}
        ${ingredients.length ? `
          <div class="recipe-detail-section">
            <span>Ingredients</span>
            <ul>
              ${ingredients.map((ingredient) => `<li>${escapeHtml(ingredient)}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
        ${directions ? `
          <div class="recipe-detail-section">
            <span>Directions</span>
            <p>${escapeHtml(directions)}</p>
          </div>
        ` : ""}
      </div>
    </section>
  `;
}

function renderActiveView() {
  controls.planView.classList.toggle("is-hidden", state.activeView !== "plan");
  controls.shoppingView.classList.toggle("is-hidden", state.activeView !== "shopping");
  controls.recipesView.classList.toggle("is-hidden", state.activeView !== "recipes");
  controls.historyView.classList.toggle("is-hidden", state.activeView !== "history");
  controls.importView.classList.toggle("is-hidden", state.activeView !== "import");
  controls.viewTabs.forEach((button) => {
    const isActive = button.dataset.viewTab === state.activeView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (state.activeView === "recipes") renderRecipesView();
  if (state.activeView === "shopping") renderCurrentShoppingList();
  if (state.activeView === "history") renderSavedWeeksList();
  if (state.activeView === "import") renderImportView();
}

function renderImportView() {
  renderImportPanel();
  bindImportEvents();
}

function renderRecipesView() {
  const visibleRecipes = getFilteredRecipes();
  if (!state.selectedRecipeId && visibleRecipes.length) {
    state.selectedRecipeId = visibleRecipes[0].id;
  }

  const selectedRecipeStillExists = state.recipes.some((recipe) => recipe.id === state.selectedRecipeId);
  if (!selectedRecipeStillExists) {
    state.selectedRecipeId = visibleRecipes[0]?.id ?? state.recipes[0]?.id ?? null;
  }

  controls.recipeLibraryList.innerHTML = visibleRecipes.length
    ? visibleRecipes.map((recipe) => renderRecipeListItem(recipe)).join("")
    : `<p class="empty-state">No recipes match this filter.</p>`;
  controls.recipeLibraryCount.textContent = `${visibleRecipes.length} of ${state.recipes.length} recipes`;

  renderRecipeDetail();
  bindRecipeLibraryEvents();
}

function renderImportPanel() {
  const files = [...state.importFiles].sort((a, b) => {
    const modifiedDiff = Number(b.modified ?? 0) - Number(a.modified ?? 0);
    if (modifiedDiff) return modifiedDiff;
    return String(a.name).localeCompare(String(b.name));
  });
  const selectedCount = files.filter((file) => state.selectedImportFiles.has(file.name)).length;

  controls.importFileList.innerHTML = files.length
    ? files.map((file) => `
        <label class="import-file">
          <input
            type="checkbox"
            data-import-file="${escapeHtml(file.name)}"
            ${state.selectedImportFiles.has(file.name) ? "checked" : ""}
            ${state.importBusy ? "disabled" : ""}
          />
          <span>${escapeHtml(file.name)}</span>
          <small>${escapeHtml(formatImportFileMeta(file))}</small>
        </label>
      `).join("")
    : `<p>No .paprikarecipes files found.</p>`;

  controls.importButton.disabled = state.importBusy || selectedCount === 0;
  controls.importButton.textContent = state.importBusy ? "Updating..." : "Update recipes";
  controls.importStatus.textContent = state.importStatus;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatImportFileMeta(file) {
  const parts = [formatFileSize(file.size)];
  const modified = Number(file.modified);
  if (Number.isFinite(modified)) {
    parts.push(`updated ${new Date(modified * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`);
  }
  return parts.filter(Boolean).join(" · ");
}

function getFilteredRecipes() {
  const query = state.recipeSearch.trim().toLowerCase();

  return state.recipes
    .filter((recipe) => {
      const feedback = state.recipeFeedback[recipe.id] ?? {};
      const tags = getEffectiveTags(recipe);
      const hidden = isRecipeHidden(recipe);
      if (state.recipeFilter === "needsReview") {
        return !hidden && feedback.reviewed !== true;
      }
      if (state.recipeFilter === "hidden") return hidden;
      if (hidden) return false;
      if (state.recipeFilter === "often") return getRepeatPreference(recipe) === "often";
      if (state.recipeFilter === "rare") return getRepeatPreference(recipe) === "rare";
      if (state.recipeFilter === "avoid") return getRepeatPreference(recipe) === "avoid";
      if (state.recipeFilter === "healthy") return tags.has("healthy");
      if (state.recipeFilter === "snackDessert") return isSnackDessertRecipe(recipe);
      return true;
    })
    .filter((recipe) => {
      if (!query) return true;
      const haystack = [
        recipe.title,
        getRecipeDisplayTitle(recipe),
        recipe.source,
        ...(recipe.categories ?? []),
        ...(recipe.ingredients ?? []),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => getRecipeDisplayTitle(a).localeCompare(getRecipeDisplayTitle(b)));
}

function renderRecipeListItem(recipe) {
  const displayTitle = getRecipeDisplayTitle(recipe);

  return `
    <button class="recipe-list-item ${recipe.id === state.selectedRecipeId ? "is-selected" : ""}" type="button" data-select-library-recipe="${escapeHtml(recipe.id)}">
      <strong>${escapeHtml(displayTitle)}</strong>
    </button>
  `;
}

function renderRecipeDetail() {
  const recipe = state.recipes.find((candidate) => candidate.id === state.selectedRecipeId);
  if (!recipe) {
    controls.recipeLibraryDetail.innerHTML = `<p class="empty-state">Choose a recipe to edit its planning memory.</p>`;
    return;
  }

  controls.recipeLibraryDetail.innerHTML = `
    <article class="recipe-detail">
      <div class="recipe-detail-heading">
        <div>
          <p class="eyebrow">Planner attributes</p>
          <h2>${escapeHtml(getRecipeDisplayTitle(recipe))}</h2>
          <p class="recipe-original-title ${getRecipeDisplayTitle(recipe) === recipe.title ? "is-hidden" : ""}">Paprika title: ${escapeHtml(recipe.title)}</p>
        </div>
      </div>
      ${renderRecipeFeedback(recipe, true)}
      ${renderRecipeDetails(recipe)}
      ${renderImportStamp(recipe)}
    </article>
  `;
}

function renderImportStamp(recipe) {
  if (!recipe.importedAt) return "";

  return `
    <p class="recipe-import-stamp">Imported into app: ${escapeHtml(recipe.importedAt)}</p>
  `;
}

function openSourceOverlay(url, title = "Source") {
  if (!controls.sourceOverlay || !controls.sourceFrame || !controls.sourceExternalLink) return;

  controls.sourceDialogTitle.textContent = title || "Source";
  controls.sourceExternalLink.href = url;
  controls.sourceFrame.src = url;
  controls.sourceOverlay.classList.remove("is-hidden");
  controls.sourceOverlay.setAttribute("aria-hidden", "false");
  controls.closeSourceOverlay?.focus();
}

function closeSourceOverlay() {
  if (!controls.sourceOverlay || !controls.sourceFrame) return;

  controls.sourceOverlay.classList.add("is-hidden");
  controls.sourceOverlay.setAttribute("aria-hidden", "true");
  controls.sourceFrame.src = "about:blank";
}

function updateRecipeDetailHeading(control) {
  const recipe = state.recipes.find((candidate) => candidate.id === control.dataset.feedbackRecipe);
  const heading = controls.recipeLibraryDetail.querySelector(".recipe-detail-heading h2");
  const originalTitle = controls.recipeLibraryDetail.querySelector(".recipe-original-title");
  if (!recipe || !heading) return;

  const displayTitle = getRecipeDisplayTitle(recipe);
  heading.textContent = displayTitle;
  if (originalTitle) {
    originalTitle.classList.toggle("is-hidden", displayTitle === recipe.title);
  }
}

function bindRecipeLibraryEvents() {
  controls.recipeLibraryList.querySelectorAll("[data-select-library-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRecipeId = button.dataset.selectLibraryRecipe;
      renderRecipesView();
    });
  });

  controls.recipeLibraryDetail.querySelectorAll("[data-feedback]").forEach((control) => {
    if (control.dataset.feedbackField === "displayTitle") {
      control.addEventListener("input", () => {
        updateRecipeFeedback(control);
        updateRecipeDetailHeading(control);
      });
      control.addEventListener("blur", () => {
        renderRecipesView();
      });
      return;
    }

    control.addEventListener("change", () => {
      updateRecipeFeedback(control);
      renderRecipesView();
    });
  });

  controls.recipeLibraryDetail.querySelectorAll("[data-feedback-tag]").forEach((control) => {
    control.addEventListener("change", () => {
      updateRecipeMemoryTag(control);
      renderRecipesView();
    });
  });

  controls.recipeLibraryDetail.querySelectorAll("[data-feedback-role]").forEach((control) => {
    control.addEventListener("change", () => {
      updateRecipeRole(control);
      renderRecipesView();
    });
  });

  controls.recipeLibraryDetail.querySelectorAll("[data-feedback-addon-role]").forEach((control) => {
    control.addEventListener("change", () => {
      updateRecipeAddOnRole(control);
      renderRecipesView();
    });
  });

  controls.recipeLibraryDetail.querySelectorAll("[data-recipe-details]").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.open) state.openRecipeDetails.add(details.dataset.recipeDetails);
      else state.openRecipeDetails.delete(details.dataset.recipeDetails);
    });
  });

  controls.recipeLibraryDetail.querySelectorAll("[data-view-source-url]").forEach((button) => {
    button.addEventListener("click", () => {
      openSourceOverlay(button.dataset.viewSourceUrl, button.dataset.viewSourceTitle);
    });
  });

}

function bindImportEvents() {
  controls.importFileList.querySelectorAll("[data-import-file]").forEach((control) => {
    control.addEventListener("change", () => {
      if (control.checked) state.selectedImportFiles.add(control.dataset.importFile);
      else state.selectedImportFiles.delete(control.dataset.importFile);
      renderImportPanel();
      bindImportEvents();
    });
  });
}

function renderLockedSummary(day) {
  const dishes = getFinalDishes(day);
  const recipeMemories = getFinalRecipeMemories(day);
  const reviewItems = getReviewItems(day);

  return `
    <div class="locked-summary">
      <label class="lock-toggle">
        <input type="checkbox" data-lock-day="${escapeHtml(day.label)}" checked />
        <span>Locked</span>
      </label>
      <div class="final-dishes">
        ${dishes.map((dish) => `
          <div class="final-dish">
            <span>${escapeHtml(formatRole(dish.role))}</span>
            <div class="final-dish-main">
              <strong>${escapeHtml(dish.title)}</strong>
              ${dish.recipeId ? `
                <button
                  class="small-button final-dish-detail-button"
                  type="button"
                  data-open-plan-recipe="${escapeHtml(dish.recipeId)}"
                >
                  View recipe
                </button>
              ` : ""}
            </div>
          </div>
        `).join("")}
      </div>
      ${reviewItems.length ? renderReviewWeek(day, reviewItems) : ""}
      ${recipeMemories.length ? `
        <details class="locked-memory" data-plan-review-section="${escapeHtml(getPlanReviewSectionKey(day.label, "recipes"))}" ${state.openPlanReviewSections.has(getPlanReviewSectionKey(day.label, "recipes")) ? "open" : ""}>
          <summary>Review recipes</summary>
          <div class="locked-memory-list">
            ${recipeMemories.map((recipe) => renderRecipeFeedback(recipe)).join("")}
          </div>
        </details>
      ` : ""}
    </div>
  `;
}

function getDayStatusLabel(day) {
  if (day.carriedFromPreviousWeek) return "Carried over";
  if (day.noCook) return "No meals";
  if (day.noDinner) return "No dinner";
  return day.busy ? "Busy" : "Normal";
}

function renderReviewWeek(day, reviewItems) {
  return `
    <details class="review-week" data-plan-review-section="${escapeHtml(getPlanReviewSectionKey(day.label, "week"))}" ${state.openPlanReviewSections.has(getPlanReviewSectionKey(day.label, "week")) ? "open" : ""}>
      <summary>Review week</summary>
      <div class="review-week-list">
        ${reviewItems.map((item) => {
          const record = state.cookingHistory[item.key] ?? {};
          return `
            <div class="review-week-item">
              <div>
                <span>${escapeHtml(formatRole(item.role))}</span>
                <strong>${escapeHtml(item.title)}</strong>
              </div>
              <div class="review-actions" aria-label="Review ${escapeHtml(item.title)}">
                ${renderReviewButton(item, "cooked", "Cooked", record.status)}
                ${renderReviewButton(item, "notCooked", "Didn't cook", record.status)}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </details>
  `;
}

function getPlanReviewSectionKey(dayLabel, section) {
  return `${dayLabel}:${section}`;
}

function openPlanRecipe(recipeId) {
  const recipe = state.recipes.find((candidate) => candidate.id === recipeId);
  if (!recipe) return;
  openQuickRecipeOverlay(recipe);
}

function renderReviewButton(item, status, label, currentStatus) {
  return `
    <button
      class="review-button ${currentStatus === status ? "is-selected" : ""}"
      type="button"
      data-review-status="${status}"
      data-review-key="${escapeHtml(item.key)}"
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function getFinalDishes(day) {
  if (day.noCook) return [{ role: "plan", title: "No cooking" }];

  const dishes = [];
  if (day.customLunch) dishes.push({ role: "lunch", title: day.customLunch });
  else if (day.lunch) dishes.push({ role: "lunch idea", title: getRecipeDisplayTitle(day.lunch), recipeId: day.lunch.id });
  (state.dayDishes[day.label] ?? [])
    .filter((dish) => dish.mealType === "lunch")
    .forEach((dish) => {
      dishes.push({
        role: `lunch ${dish.role}`,
        title: getDishTitle(dish),
        recipeId: dish.source === "recipe" ? dish.recipeId : "",
      });
    });
  if (day.customSnackDessert) dishes.push({ role: "snack/dessert", title: day.customSnackDessert });
  else if (day.snackDessert) dishes.push({ role: "snack/dessert idea", title: getRecipeDisplayTitle(day.snackDessert), recipeId: day.snackDessert.id });
  if (day.customDinner) dishes.push({ role: "dinner", title: day.customDinner });
  else if (day.dinner) dishes.push({ role: "dinner idea", title: getRecipeDisplayTitle(day.dinner), recipeId: day.dinner.id });
  if (!day.customDinner && day.side) dishes.push({ role: "side", title: getRecipeDisplayTitle(day.side), recipeId: day.side.id });

  (state.dayDishes[day.label] ?? [])
    .filter((dish) => (dish.mealType ?? "dinner") === "dinner")
    .forEach((dish) => {
      dishes.push({
        role: dish.role,
        title: getDishTitle(dish),
        recipeId: dish.source === "recipe" ? dish.recipeId : "",
      });
    });

  return dishes;
}

function getReviewItems(day) {
  if (day.noCook) return [];

  const items = [];
  const addItem = ({ role, title, mealType, recipe = null, source = "manual", sourceId = "" }) => {
    if (!title) return;
    const plannedFor = getPlannedDate(day.label);
    const identity = recipe?.id ?? sourceId ?? slugify(`${role}-${title}`);
    items.push({
      key: `${plannedFor}:${day.label}:${mealType}:${role}:${identity}`,
      plannedFor,
      dayLabel: day.label,
      mealType,
      role,
      title,
      source,
      recipeId: recipe?.id ?? "",
    });
  };

  if (day.customLunch) addItem({ role: "lunch", title: day.customLunch, mealType: "lunch" });
  else if (day.lunch) addItem({ role: "lunch", title: getRecipeDisplayTitle(day.lunch), mealType: "lunch", recipe: day.lunch, source: "recipe" });

  (state.dayDishes[day.label] ?? [])
    .filter((dish) => dish.mealType === "lunch")
    .forEach((dish) => {
      const recipe = dish.source === "recipe"
        ? state.recipes.find((candidate) => candidate.id === dish.recipeId)
        : null;
      addItem({
        role: dish.role,
        title: getDishTitle(dish),
        mealType: "lunch",
        recipe,
        source: dish.source,
        sourceId: dish.id,
      });
    });

  if (day.customSnackDessert) addItem({ role: "snack/dessert", title: day.customSnackDessert, mealType: "snackDessert" });
  else if (day.snackDessert) {
    addItem({
      role: "snack/dessert",
      title: getRecipeDisplayTitle(day.snackDessert),
      mealType: "snackDessert",
      recipe: day.snackDessert,
      source: "recipe",
    });
  }

  if (day.customDinner) addItem({ role: "dinner", title: day.customDinner, mealType: "dinner" });
  else if (day.dinner) addItem({ role: "dinner", title: getRecipeDisplayTitle(day.dinner), mealType: "dinner", recipe: day.dinner, source: "recipe" });

  if (!day.customDinner && day.side) {
    addItem({ role: "side", title: getRecipeDisplayTitle(day.side), mealType: "dinner", recipe: day.side, source: "recipe" });
  }

  (state.dayDishes[day.label] ?? [])
    .filter((dish) => (dish.mealType ?? "dinner") === "dinner")
    .forEach((dish) => {
      const recipe = dish.source === "recipe"
        ? state.recipes.find((candidate) => candidate.id === dish.recipeId)
        : null;
      addItem({
        role: dish.role,
        title: getDishTitle(dish),
        mealType: "dinner",
        recipe,
        source: dish.source,
        sourceId: dish.id,
      });
    });

  return items;
}

function getPlannedDate(dayLabel) {
  return formatDateKey(getPlannedDateObject(dayLabel));
}

function getPlannedDateObject(dayLabel) {
  const start = getPlanningWeekStartDate();
  const offset = dinnerDays.indexOf(dayLabel);
  const date = new Date(start);
  date.setDate(start.getDate() + Math.max(offset, 0));
  return date;
}

function getPlanningWeekStartDate() {
  return dateFromKey(state.selectedWeekStart || getDefaultPlanningWeekStartKey());
}

function getDefaultPlanningWeekStartKey() {
  return formatDateKey(getNextMonday(new Date()));
}

function getCurrentWeekStartKey() {
  return formatDateKey(getMondayForWeek(new Date()));
}

function getNextWeekStartKey() {
  return formatDateKey(getNextMonday(new Date()));
}

function getMondayForWeek(value) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const dayOfWeek = date.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date;
}

function getNextMonday(value) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const dayOfWeek = date.getDay();
  const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  return date;
}

function dateFromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDaysToKey(key, days) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getPlannedDateLabel(dayLabel) {
  return formatShortDate(getPlannedDateObject(dayLabel));
}

function renderPlanningWeekLabel() {
  if (!controls.planningWeekLabel) return;

  controls.planningWeekLabel.textContent = `Planning week: ${getPlanningWeekRangeLabel()}`;
}

function renderPlanningWeekSwitcher() {
  if (!controls.planningWeekName || !controls.planningWeekRange) return;
  const currentWeek = getCurrentWeekStartKey();
  const nextWeek = getNextWeekStartKey();
  controls.planningWeekName.textContent = getWeekSwitcherName(state.selectedWeekStart, currentWeek, nextWeek);
  controls.planningWeekRange.textContent = getWeekRangeLabel(state.selectedWeekStart);
  if (controls.currentWeekButton) controls.currentWeekButton.disabled = state.selectedWeekStart === currentWeek;
}

function getWeekSwitcherName(weekStart, currentWeek, nextWeek) {
  if (weekStart === currentWeek) return "Current week";
  if (weekStart === nextWeek) return "Next week";
  if (weekStart === addDaysToKey(nextWeek, 7)) return "Week after next";
  return "Planning week";
}

function getWeekRangeLabel(weekStart) {
  const start = dateFromKey(weekStart);
  const end = dateFromKey(addDaysToKey(weekStart, 7));
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function getFinalRecipeMemories(day) {
  if (day.noCook) return [];

  const recipes = [
    day.customLunch ? null : day.lunch,
    day.customDinner ? null : day.dinner,
    day.customDinner ? null : day.side,
    day.customSnackDessert ? null : day.snackDessert,
    ...(state.dayDishes[day.label] ?? [])
      .filter((dish) => dish.source === "recipe")
      .map((dish) => state.recipes.find((recipe) => recipe.id === dish.recipeId)),
  ].filter(Boolean);
  const seen = new Set();

  return recipes.filter((recipe) => {
    if (seen.has(recipe.id)) return false;
    seen.add(recipe.id);
    return true;
  });
}

function renderDayControls(day) {
  const isLocked = state.lockedDays.has(day.label);

  return `
    <div class="day-controls">
      <label class="lock-toggle">
        <input type="checkbox" data-lock-day="${escapeHtml(day.label)}" ${isLocked ? "checked" : ""} />
        <span>Lock</span>
      </label>
    </div>
  `;
}

function renderMealNoteInput(day, mealType) {
  const note = getMealNote(day.label, mealType);
  const shoppingItems = getManualShoppingItems(day.label, mealType);
  const placeholders = {
    lunch: "Lunch note, leftovers, request...",
    dinner: "Frozen pizza, leftovers, request...",
    snackDessert: "Snack, dessert, fruit, cake...",
  };
  const placeholder = placeholders[mealType] ?? "Write my own";

  return `
    <div class="meal-note">
      <span>Write my own</span>
      <div class="manual-meal-fields">
        <input
          type="text"
          value="${escapeHtml(note)}"
          placeholder="${escapeHtml(placeholder)}"
          data-day-note="${escapeHtml(day.label)}"
          data-day-note-meal="${mealType}"
        />
        <textarea
          rows="2"
          placeholder="Shopping items, separated by commas or lines"
          data-day-shopping-items="${escapeHtml(day.label)}"
          data-day-shopping-meal="${mealType}"
        >${escapeHtml(shoppingItems)}</textarea>
      </div>
    </div>
  `;
}

function renderRecipeFeedback(recipe, isOpen = false) {
  const feedback = state.recipeFeedback[recipe.id] ?? {};
  const tags = getEffectiveTags(recipe);
  const repeatPreference = feedback.repeatPreference ?? recipe.defaultRepeatPreference ?? "normal";
  const displayTitle = getRecipeDisplayTitle(recipe);
  const content = `
    <div class="feedback-grid">
      <label>
        <span>Display name</span>
        <input
          type="text"
          data-feedback
          data-feedback-recipe="${escapeHtml(recipe.id)}"
          data-feedback-field="displayTitle"
          value="${escapeHtml(displayTitle)}"
          placeholder="${escapeHtml(recipe.title)}"
        />
      </label>
      <div class="planner-use">
        <span>Planner visibility</span>
        <div class="memory-tags">
          <label class="memory-chip">
            <input
              type="checkbox"
              data-feedback
              data-feedback-recipe="${escapeHtml(recipe.id)}"
              data-feedback-field="hiddenFromPlanner"
              ${feedback.hiddenFromPlanner === true ? "checked" : ""}
            />
            <span>Hidden from planner</span>
          </label>
        </div>
      </div>
      <label>
        <span>Repeat</span>
        <select data-feedback data-feedback-recipe="${escapeHtml(recipe.id)}" data-feedback-field="repeatPreference">
          <option value="normal" ${repeatPreference === "normal" ? "selected" : ""}>Normal</option>
          <option value="often" ${repeatPreference === "often" ? "selected" : ""}>Often</option>
          <option value="rare" ${repeatPreference === "rare" ? "selected" : ""}>Rarely</option>
          <option value="avoid" ${repeatPreference === "avoid" ? "selected" : ""}>Avoid</option>
        </select>
      </label>
      <div class="planner-use">
        <span>Meal role</span>
        <div class="memory-tags">
          ${renderRoleToggle(recipe.id, "main", "Main")}
          ${renderRoleToggle(recipe.id, "addOn", "Add-on")}
          ${renderRoleToggle(recipe.id, "snackDessert", "Snack/dessert")}
        </div>
      </div>
      ${isAddOnRecipe(recipe) ? `
        <div class="planner-use">
          <span>Add-on type</span>
          <div class="memory-tags">
            ${renderAddOnTypeToggle(recipe.id, "side", "Flexible side")}
            ${renderAddOnTypeToggle(recipe.id, "appetizer", "Appetizer")}
            ${renderAddOnTypeToggle(recipe.id, "salad", "Salad")}
            ${renderAddOnTypeToggle(recipe.id, "vegetable", "Vegetable")}
            ${renderAddOnTypeToggle(recipe.id, "carb", "Carb")}
            ${renderAddOnTypeToggle(recipe.id, "protein", "Protein")}
          </div>
        </div>
      ` : ""}
      <div class="planner-use">
        <span>Cuisine style</span>
        <div class="memory-tags">
          ${renderMemoryTag(recipe.id, "asian", "Asian")}
          ${renderMemoryTag(recipe.id, "western", "Western")}
          ${renderMemoryTag(recipe.id, "flexibleCuisine", "Flexible")}
        </div>
      </div>
      <div class="planner-use">
        <span>Planning tags</span>
        <div class="memory-tags">
          ${renderMemoryTag(recipe.id, "easy", "Easy")}
          ${renderMemoryTag(recipe.id, "creative", "Creative")}
          ${renderMemoryTag(recipe.id, "healthy", "Healthy")}
          ${renderMemoryTag(recipe.id, "busyDay", "Busy day")}
          ${renderMemoryTag(recipe.id, "weekend", "Weekend")}
          ${renderMemoryTag(recipe.id, "hotDay", "Hot day")}
          ${renderMemoryTag(recipe.id, "light", "Light")}
          ${renderMemoryTag(recipe.id, "cozy", "Cozy")}
          ${renderMemoryTag(recipe.id, "spring", "Spring")}
          ${renderMemoryTag(recipe.id, "summer", "Summer")}
          ${renderMemoryTag(recipe.id, "autumn", "Autumn")}
          ${renderMemoryTag(recipe.id, "winter", "Winter")}
          ${renderMemoryTag(recipe.id, "keeps", "Keeps")}
          ${renderMemoryTag(recipe.id, "startEarly", "Start early")}
          ${renderMemoryTag(recipe.id, "handsOn", "Hands-on")}
          ${renderMemoryTag(recipe.id, "entertaining", "Special occasion")}
        </div>
      </div>
      <label class="comment-row">
        <span>Comment</span>
        <textarea data-feedback data-feedback-recipe="${escapeHtml(recipe.id)}" data-feedback-field="comment" rows="3" placeholder="What should future-you remember?">${escapeHtml(feedback.comment ?? "")}</textarea>
      </label>
    </div>
  `;

  if (isOpen) {
    return `
      <section class="recipe-feedback recipe-attributes">
        <div class="attributes-heading">
          <h3>Attributes</h3>
          ${renderReviewedToggle(recipe.id, feedback)}
        </div>
        ${content}
      </section>
    `;
  }

  return `
    <details class="recipe-feedback">
      <summary>${escapeHtml(displayTitle)}</summary>
      ${content}
    </details>
  `;

  function renderMemoryTag(recipeId, tag, label) {
    const checked = tags.has(tag) || feedback[tag] === true;
    return `
      <label class="memory-chip">
        <input type="checkbox" data-feedback-tag data-feedback-recipe="${escapeHtml(recipeId)}" data-feedback-tag-value="${tag}" ${checked ? "checked" : ""} />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  function renderRoleToggle(recipeId, role, label) {
    const checked = isRecipeRoleEnabled(recipe, role);
    return `
      <label class="memory-chip">
        <input type="checkbox" data-feedback-role data-feedback-recipe="${escapeHtml(recipeId)}" data-feedback-role-value="${role}" ${checked ? "checked" : ""} />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  function renderAddOnTypeToggle(recipeId, addOnType, label) {
    const checked = getAddOnRoles(recipe).includes(addOnType);
    return `
      <label class="memory-chip">
        <input type="checkbox" data-feedback-addon-role data-feedback-recipe="${escapeHtml(recipeId)}" data-feedback-addon-role-value="${addOnType}" ${checked ? "checked" : ""} />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  function renderReviewedToggle(recipeId, recipeFeedback) {
    return `
      <label class="memory-chip reviewed-chip">
        <input
          type="checkbox"
          data-feedback
          data-feedback-recipe="${escapeHtml(recipeId)}"
          data-feedback-field="reviewed"
          ${recipeFeedback.reviewed === true ? "checked" : ""}
        />
        <span>Reviewed</span>
      </label>
    `;
  }
}

function renderMealBuilder(day, mealType) {
  const isLocked = state.lockedDays.has(day.label);
  const addedDishes = (state.dayDishes[day.label] ?? []).filter((dish) => (dish.mealType ?? "dinner") === mealType);
  const activeRole = state.activeAdders[getMealKey(day.label, mealType)] ?? null;

  const automaticSide = mealType === "dinner" && day.side
    ? `
      <div class="added-dish">
        <span>Side</span>
        <strong>${escapeHtml(getRecipeDisplayTitle(day.side))}</strong>
        <div class="added-dish-actions">
          <button class="remove-button" type="button" data-remove-auto-side="${escapeHtml(day.label)}" ${isLocked ? "disabled" : ""}>Remove</button>
        </div>
      </div>
    `
    : "";

  const added = automaticSide || addedDishes.length
    ? `
      <div class="added-dishes">
        ${automaticSide}
        ${addedDishes.map((dish) => renderAddedDish(day.label, dish, isLocked)).join("")}
      </div>
    `
    : "";

  return `
    <section class="meal-builder">
      <div class="meal-builder-heading">
        <h4>Build out ${mealType}</h4>
      </div>
      <div class="add-role-buttons">
        ${suggestionRoles.map((role) => `
          <button
            class="chip-button"
            type="button"
            data-open-add-role="${escapeHtml(day.label)}"
            data-open-add-meal="${mealType}"
            data-open-add-role-value="${role}"
            ${isLocked ? "disabled" : ""}
          >
            ${escapeHtml(formatRole(role))}
          </button>
        `).join("")}
      </div>
      ${activeRole ? renderAddDishChooser(day, mealType, activeRole, isLocked) : ""}
      ${added}
    </section>
  `;
}

function renderAddDishChooser(day, mealType, role, isLocked) {
  const suggestedRecipes = getSuggestedRecipes(day, role, mealType, 3);
  const quickOptions = role === "carb"
    ? ["Rice", "Bread", "Noodles", "Potatoes"]
    : [];
  const manualPlaceholder = `Write your own ${role}`;

  return `
    <div class="add-dish-chooser">
      <div class="chooser-header">
        <strong>Add ${escapeHtml(formatRole(role))}</strong>
        <button class="small-button" type="button" data-close-add-role="${escapeHtml(day.label)}" data-close-add-meal="${mealType}" ${isLocked ? "disabled" : ""}>Close</button>
      </div>
      ${quickOptions.length ? `
        <div class="quick-options">
          ${quickOptions.map((title) => `
            <button
              class="chip-button"
              type="button"
              data-add-quick-dish="${escapeHtml(day.label)}"
              data-add-meal="${mealType}"
              data-add-role="${role}"
              data-add-title="${escapeHtml(title)}"
              ${isLocked ? "disabled" : ""}
            >
              ${escapeHtml(title)}
            </button>
          `).join("")}
        </div>
      ` : ""}
      ${suggestedRecipes.length ? `
        <div class="meal-options-heading add-suggestions-heading">
          <span>Suggestions</span>
          <button
            class="small-button"
            type="button"
            data-regenerate-addon-suggestions="${escapeHtml(day.label)}"
            data-add-meal="${mealType}"
            data-add-role="${role}"
            ${isLocked ? "disabled" : ""}
          >
            Regenerate
          </button>
        </div>
        <div class="suggested-recipes">
          ${suggestedRecipes.map((recipe) => `
            <button
              class="suggested-recipe"
              type="button"
              data-add-suggested-recipe="${escapeHtml(day.label)}"
              data-add-meal="${mealType}"
              data-add-role="${role}"
              data-add-recipe-id="${escapeHtml(recipe.id)}"
              ${isLocked ? "disabled" : ""}
            >
              <strong>${escapeHtml(getRecipeDisplayTitle(recipe))}</strong>
              ${renderRecipeTimeFlags(recipe)}
            </button>
          `).join("")}
        </div>
      ` : ""}
      <div class="chooser-section-label">Or choose manually</div>
      <div class="chooser-search">
        <input
          type="search"
          placeholder="Search and choose a recipe"
          data-addon-recipe-search
          data-add-meal="${mealType}"
          ${isLocked ? "disabled" : ""}
        />
        <div class="recipe-picker-results" data-addon-recipe-results></div>
        <button class="small-button" type="button" data-add-selected-recipe="${escapeHtml(day.label)}" data-add-meal="${mealType}" data-add-role="${role}" ${isLocked ? "disabled" : ""}>Add recipe</button>
      </div>
      <div class="chooser-section-label">Or write my own</div>
      <div class="chooser-manual">
        <input type="text" placeholder="${escapeHtml(manualPlaceholder)}" data-custom-title ${isLocked ? "disabled" : ""} />
        <textarea rows="2" placeholder="Shopping items, separated by commas or lines" data-custom-shopping-items ${isLocked ? "disabled" : ""}></textarea>
        <button class="small-button" type="button" data-add-manual-dish="${escapeHtml(day.label)}" data-add-meal="${mealType}" data-add-role="${role}" ${isLocked ? "disabled" : ""}>Add custom entry</button>
      </div>
    </div>
  `;
}

function renderAddedDish(dayLabel, dish, isLocked) {
  const title = getDishTitle(dish);
  const shoppingItems = dish.source === "manual" ? dish.shoppingItems?.trim() : "";

  return `
    <div class="added-dish">
      <span>${escapeHtml(formatRole(dish.role))}</span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        ${shoppingItems ? `<small>Shopping: ${escapeHtml(shoppingItems)}</small>` : ""}
      </div>
      <button
        class="remove-button"
        type="button"
        data-remove-dish-day="${escapeHtml(dayLabel)}"
        data-remove-dish="${escapeHtml(dish.id)}"
        ${isLocked ? "disabled" : ""}
      >
        Remove
      </button>
    </div>
  `;
}

function formatRole(role) {
  return role
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getDishTitle(dish) {
  if (dish.source !== "recipe") return dish.title;

  const recipe = state.recipes.find((candidate) => candidate.id === dish.recipeId);
  return recipe ? getRecipeDisplayTitle(recipe) : dish.title;
}

function getEffectiveRoles(recipe) {
  const feedback = state.recipeFeedback[recipe.id] ?? {};
  if (Array.isArray(feedback.roles)) return feedback.roles;
  if (Array.isArray(recipe.defaultRoles)) return recipe.defaultRoles;

  const roles = new Set();
  const importedMealTypes = recipe.mealTypes ?? [];
  if (importedMealTypes.includes("dinner") || importedMealTypes.includes("lunch")) roles.add("main");
  if (importedMealTypes.some((mealType) => ["snack", "dessert", "snackDessert"].includes(mealType))) roles.add("snackDessert");
  if (recipe.recipeRole === "side" || feedback.useAsAddOn === true) roles.add("addOn");
  if (Array.isArray(feedback.mealTypes)) {
    if (feedback.mealTypes.includes("dinner") || feedback.mealTypes.includes("lunch")) roles.add("main");
    if (feedback.mealTypes.includes("snackDessert")) roles.add("snackDessert");
  }
  if (roles.size === 0) roles.add("main");

  return [...roles];
}

function hasRoleOverride(recipe) {
  return Array.isArray(state.recipeFeedback[recipe.id]?.roles);
}

function isRecipeRoleEnabled(recipe, role) {
  return getEffectiveRoles(recipe).includes(role);
}

function isMainRecipe(recipe) {
  return isRecipeRoleEnabled(recipe, "main");
}

function isAddOnRecipe(recipe) {
  return isRecipeRoleEnabled(recipe, "addOn");
}

function getAddOnRole(recipe) {
  return getAddOnRoles(recipe)[0] ?? "side";
}

function getAddOnRoles(recipe) {
  const feedback = state.recipeFeedback[recipe.id] ?? {};
  if (Array.isArray(feedback.addOnRoles)) return feedback.addOnRoles;
  if (feedback.addOnRole) return [feedback.addOnRole];
  if (Array.isArray(recipe.defaultAddOnRoles)) return recipe.defaultAddOnRoles;
  if (recipe.defaultAddOnRole) return [recipe.defaultAddOnRole];
  return ["side"];
}

function getEffectiveTags(recipe) {
  const feedback = state.recipeFeedback[recipe.id] ?? {};
  const suppressedTags = new Set(feedback.suppressedTags ?? []);
  const tags = new Set([...(recipe.defaultTags ?? []), ...(feedback.tags ?? [])]);

  if (tags.has("canMakeAhead")) tags.add("keeps");
  if (tags.has("needsTime")) tags.add("handsOn");
  suppressedTags.forEach((tag) => tags.delete(tag));
  return tags;
}

function getCuisineTags(recipe) {
  const tags = getEffectiveTags(recipe);
  return new Set(["asian", "western", "flexibleCuisine"].filter((tag) => tags.has(tag)));
}

function getRepeatPreference(recipe) {
  return state.recipeFeedback[recipe.id]?.repeatPreference ?? recipe.defaultRepeatPreference;
}

function isSnackDessertRecipe(recipe) {
  const feedback = state.recipeFeedback[recipe.id] ?? {};
  const memoryTags = getEffectiveTags(recipe);
  if (hasRoleOverride(recipe)) return isRecipeRoleEnabled(recipe, "snackDessert");
  if (isRecipeRoleEnabled(recipe, "snackDessert")) return true;
  if (memoryTags.has("snackDessert")) return true;

  if (recipe.mealTypes?.some((mealType) => mealType === "snack" || mealType === "dessert" || mealType === "snackDessert")) {
    return true;
  }

  const text = [
    recipe.title,
    ...(recipe.categories ?? []),
    ...(recipe.pairingTags ?? []),
  ].join(" ").toLowerCase();
  const terms = [
    "dessert",
    "snack",
    "cake",
    "cookie",
    "biscuit",
    "brownie",
    "muffin",
    "pudding",
    "ice cream",
    "fruit",
    "sweet",
    "baking",
    "tart",
    "pie",
  ];

  return terms.some((term) => text.includes(term));
}

function renderRecipePicker(day, mealType) {
  return `
    <div class="recipe-picker">
      <span>Choose from my recipes</span>
      <div class="recipe-picker-controls">
        <input
          type="search"
          placeholder="Search and choose a recipe"
          data-recipe-picker-input
          data-recipe-day="${escapeHtml(day.label)}"
          data-recipe-meal="${mealType}"
        />
        <div class="recipe-picker-results" data-recipe-picker-results></div>
        <button class="small-button" type="button" data-use-selected-recipe="${escapeHtml(day.label)}" data-use-meal="${mealType}">Use recipe</button>
      </div>
    </div>
  `;
}

function getRecipePickerOptions(mealType) {
  const matchingRecipes = state.recipes
    .filter((recipe) => !isRecipeHidden(recipe))
    .filter((recipe) => {
      if (mealType === "side") return isAddOnRecipe(recipe);
      if (mealType === "dinner") return isMainRecipe(recipe) && !isSnackDessertRecipe(recipe);
      if (mealType === "snackDessert") return isSnackDessertRecipe(recipe);
      if (mealType === "lunch") return isMainRecipe(recipe) && !isSnackDessertRecipe(recipe);
      return isMainRecipe(recipe) && !isSnackDessertRecipe(recipe);
    });

  return mealType === "snackDessert" && matchingRecipes.length === 0
    ? state.recipes.filter((recipe) => !isRecipeHidden(recipe))
    : matchingRecipes;
}

function getRecipeIdFromPicker(input) {
  const value = input?.value.trim();
  if (!value) return "";
  if (input.dataset.selectedRecipeId) return input.dataset.selectedRecipeId;

  const option = [...(input.list?.options ?? [])].find((candidate) => candidate.value === value);
  if (option?.dataset.recipeId) return option.dataset.recipeId;

  const mealType = input.dataset.recipeMeal;
  const query = value.toLowerCase();
  const match = getRecipePickerOptions(mealType).find((recipe) => {
    const displayTitle = getRecipeDisplayTitle(recipe).toLowerCase();
    return displayTitle === query || recipe.title.toLowerCase() === query;
  });

  return match?.id ?? "";
}

function getRecipePickerMatches(input) {
  const query = input.value.trim().toLowerCase();

  return getRecipePickerOptions(input.dataset.recipeMeal)
    .filter((recipe) => {
      if (!query) return true;

      const haystack = [
        getRecipeDisplayTitle(recipe),
        recipe.title,
        recipe.source,
        ...(recipe.categories ?? []),
        ...(recipe.ingredients ?? []),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => getRecipeDisplayTitle(a).localeCompare(getRecipeDisplayTitle(b)));
}

function renderRecipePickerResults(input) {
  const results = input.closest(".recipe-picker")?.querySelector("[data-recipe-picker-results]");
  if (!results) return;

  const matches = getRecipePickerMatches(input);

  results.innerHTML = matches.length
    ? matches.map((recipe) => `
        <button
          class="recipe-picker-result"
          type="button"
          data-select-picker-recipe="${escapeHtml(recipe.id)}"
          data-picker-title="${escapeHtml(getRecipeDisplayTitle(recipe))}"
        >
          ${escapeHtml(getRecipeDisplayTitle(recipe))}
        </button>
      `).join("")
    : `<p>No matching recipes.</p>`;

  results.querySelectorAll("[data-select-picker-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      selectRecipePickerResult(button);
    });
  });
}

function selectRecipePickerResult(button) {
  const picker = button.closest(".recipe-picker");
  const input = picker?.querySelector("[data-recipe-picker-input]");
  const results = picker?.querySelector("[data-recipe-picker-results]");
  if (!input) return;

  input.value = button.dataset.pickerTitle;
  input.dataset.selectedRecipeId = button.dataset.selectPickerRecipe;
  if (results) results.innerHTML = "";
}

function getAddOnPickerMatches(input) {
  const query = input?.value.trim().toLowerCase() ?? "";

  return state.recipes
    .filter((recipe) => !isRecipeHidden(recipe))
    .filter((recipe) => {
      if (!query) return true;

      const haystack = [
        getRecipeDisplayTitle(recipe),
        recipe.title,
        recipe.source,
        ...(recipe.categories ?? []),
        ...(recipe.ingredients ?? []),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => getRecipeDisplayTitle(a).localeCompare(getRecipeDisplayTitle(b)));
}

function renderAddOnRecipeResults(input) {
  const results = input.closest(".add-dish-chooser")?.querySelector("[data-addon-recipe-results]");
  if (!results) return;

  const matches = getAddOnPickerMatches(input);
  results.innerHTML = matches.length
    ? matches.map((recipe) => `
        <button
          class="recipe-picker-result"
          type="button"
          data-select-addon-recipe="${escapeHtml(recipe.id)}"
          data-picker-title="${escapeHtml(getRecipeDisplayTitle(recipe))}"
        >
          ${escapeHtml(getRecipeDisplayTitle(recipe))}
        </button>
      `).join("")
    : `<p>No matching recipes.</p>`;

  results.querySelectorAll("[data-select-addon-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      selectAddOnRecipeResult(button);
    });
  });
}

function selectAddOnRecipeResult(button) {
  const chooser = button.closest(".add-dish-chooser");
  const input = chooser?.querySelector("[data-addon-recipe-search]");
  const results = chooser?.querySelector("[data-addon-recipe-results]");
  if (!input) return;

  input.value = button.dataset.pickerTitle;
  input.dataset.selectedRecipeId = button.dataset.selectAddonRecipe;
  if (results) results.innerHTML = "";
}

function getAddOnRecipeIdFromPicker(input) {
  const value = input?.value.trim();
  if (!value) return "";
  if (input.dataset.selectedRecipeId) return input.dataset.selectedRecipeId;

  const query = value.toLowerCase();
  const match = state.recipes
    .filter((recipe) => !isRecipeHidden(recipe))
    .find((recipe) => {
      const displayTitle = getRecipeDisplayTitle(recipe).toLowerCase();
      return displayTitle === query || recipe.title.toLowerCase() === query;
    });

  return match?.id ?? "";
}

function filterRecipeOptions(input) {
  const select = input
    .closest(".recipe-picker")
    ?.querySelector("[data-recipe-select]");
  if (!select) return;

  const query = input.value.trim().toLowerCase();
  let firstVisibleOption = null;

  [...select.options].forEach((option) => {
    const isPlaceholder = option.hasAttribute("data-placeholder");
    const isVisible = isPlaceholder ? !query : !query || option.dataset.title.includes(query);
    option.hidden = !isVisible;
    if (isVisible && !firstVisibleOption) firstVisibleOption = option;
  });

  if (select.selectedOptions[0]?.hidden && firstVisibleOption) {
    select.value = firstVisibleOption.value;
  }
}

let currentShoppingGroups = [];

function renderShopping(groups) {
  currentShoppingGroups = groups;
  controls.shoppingList.innerHTML = "";

  if (!groups.length) {
    controls.shoppingList.innerHTML = `<p class="empty-state">No shopping items for this plan yet.</p>`;
    return;
  }

  groups.forEach((group) => {
    const isCollapsed = state.collapsedShoppingGroups.has(group.day);
    const article = document.createElement("article");
    article.className = "shopping-card";
    if (isCollapsed) article.classList.add("is-collapsed");

    const items = group.items
      .map((item) => renderShoppingItem(item, { showSources: true }))
      .join("");

    article.innerHTML = `
      <div class="day-card-header">
        <div>
          <h3>${escapeHtml(formatShoppingDayLabel(group.day))}</h3>
          <p>${escapeHtml(group.items.length)} ${group.items.length === 1 ? "item" : "items"} for ${escapeHtml(group.mealsCovered)}</p>
        </div>
        <button
          class="small-button subtle-button"
          type="button"
          data-toggle-shopping-group="${escapeHtml(group.day)}"
          aria-expanded="${String(!isCollapsed)}"
        >
          ${isCollapsed ? "Show" : "Minimize"}
        </button>
      </div>
      <ul class="shopping-group-items" ${isCollapsed ? "hidden" : ""}>${items}</ul>
    `;

    controls.shoppingList.append(article);
  });

  controls.shoppingList.querySelectorAll("[data-toggle-shopping-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const groupDay = button.dataset.toggleShoppingGroup;
      if (state.collapsedShoppingGroups.has(groupDay)) state.collapsedShoppingGroups.delete(groupDay);
      else state.collapsedShoppingGroups.add(groupDay);
      renderCurrentShoppingList();
    });
  });

  controls.shoppingList.querySelectorAll("[data-remove-item]").forEach((button) => {
    button.addEventListener("click", () => {
      state.removedShoppingItemIds.add(button.dataset.removeItem);
      renderCurrentShoppingList();
    });
  });

  controls.shoppingList.querySelectorAll("[data-move-item]").forEach((select) => {
    select.addEventListener("focus", () => {
      if (select.value.startsWith("combine:")) {
        select.value = select.dataset.assignedDay;
      }
    });
    select.addEventListener("change", () => {
      const value = select.value.startsWith("combine:")
        ? select.value.replace("combine:", "")
        : select.value;
      state.shoppingItemAssignments.set(select.dataset.moveItem, value);
      renderCurrentShoppingList();
    });
  });

  controls.shoppingList.querySelectorAll("[data-open-shopping-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      openShoppingRecipe(button.dataset.openShoppingRecipe, button.dataset.openShoppingSource, button.dataset.openShoppingTitle);
    });
  });

  controls.shoppingList.querySelectorAll("[data-toggle-bring-item]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeBringItemId = state.activeBringItemId === button.dataset.toggleBringItem
        ? ""
        : button.dataset.toggleBringItem;
      renderCurrentShoppingList();
    });
  });

  controls.shoppingList.querySelectorAll("[data-add-bring-item]").forEach((button) => {
    button.addEventListener("click", () => {
      addShoppingItemToBring(button);
    });
  });
}

function renderShoppingItem(item, { showSources = false } = {}) {
  const bringDefaults = state.bringItemDrafts[item.id] ?? getBringItemDefaults(item);
  const isBringOpen = state.activeBringItemId === item.id;
  const bringStatus = state.bringItemStatus[item.id];
  const bringButtonLabel = isBringOpen
    ? "Hide Bring!"
    : bringStatus?.kind === "success"
      ? "Edit Bring!"
      : "Bring!";
  const sourceRows = showSources
    ? `
      <ul class="shopping-source-list">
        ${item.sources.map((source) => `
          <li>
            ${source.recipeId || source.sourceUrl ? `
              <button
                class="shopping-source-link"
                type="button"
                data-open-shopping-recipe="${escapeHtml(source.recipeId ?? "")}"
                data-open-shopping-source="${escapeHtml(source.sourceUrl ?? "")}"
                data-open-shopping-title="${escapeHtml(source.recipeTitle)}"
              >
                ${escapeHtml(source.mealDay)} ${escapeHtml(source.mealType.toLowerCase())}: ${escapeHtml(source.recipeTitle)}
              </button>
            ` : `<span>${escapeHtml(source.mealDay)} ${escapeHtml(source.mealType.toLowerCase())}: ${escapeHtml(source.recipeTitle)}</span>`}
          </li>
        `).join("")}
      </ul>
    `
    : "";
  const combineEarlierOption = item.combineEarlierDay
    ? `<option value="combine:${escapeHtml(item.combineEarlierDay)}" selected>Add to earlier shop</option>`
    : "";
  const options = item.allowedShoppingDays
    .filter((day) => day !== item.combineEarlierDay)
    .map(
      (day) =>
        `<option value="${escapeHtml(day)}" ${!item.combineEarlierDay && day === item.assignedDay ? "selected" : ""}>${escapeHtml(formatShoppingDayLabel(day))}</option>`,
    )
    .join("");
  const canMoveItem = item.combineEarlierDay || item.allowedShoppingDays.length > 1;
  const moveControl = canMoveItem
    ? `
      <select
        data-move-item="${escapeHtml(item.id)}"
        data-assigned-day="${escapeHtml(item.assignedDay)}"
        aria-label="Choose shopping day for ${escapeHtml(item.name)}"
      >
        ${combineEarlierOption}
        ${options}
      </select>
    `
    : "";

  return `
    <li class="shopping-item">
      <div>
        <div class="shopping-item-heading">
          <strong>${escapeHtml(item.name)}</strong>
          <div class="shopping-item-buttons">
            <button class="small-button" type="button" data-toggle-bring-item="${escapeHtml(item.id)}">${bringButtonLabel}</button>
            <button class="remove-button shopping-remove-button" type="button" data-remove-item="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">×</button>
          </div>
        </div>
        ${sourceRows}
        ${isBringOpen ? renderBringItemEditor(item, bringDefaults, bringStatus) : renderBringItemStatus(bringStatus)}
      </div>
      ${moveControl ? `<div class="shopping-actions">${moveControl}</div>` : ""}
    </li>
  `;
}

function getBringItemDefaults(item) {
  const parts = item.combinableParts;
  if (parts?.itemName) {
    return {
      name: parts.itemName,
      specification: (parts.amounts ?? []).map((amount) => amount.label).filter(Boolean).join(" + "),
    };
  }
  return {
    name: item.name,
    specification: "",
  };
}

function renderBringItemEditor(item, defaults, status) {
  return `
    <div class="bring-editor">
      <label>
        <span>Bring item</span>
        <input data-bring-name="${escapeHtml(item.id)}" value="${escapeHtml(defaults.name)}" />
      </label>
      <label>
        <span>Specification</span>
        <input data-bring-specification="${escapeHtml(item.id)}" value="${escapeHtml(defaults.specification)}" placeholder="Amount, size, note" />
      </label>
      <div class="bring-editor-actions">
        <button class="small-button" type="button" data-add-bring-item="${escapeHtml(item.id)}">Add to Bring</button>
        ${renderBringItemStatus(status)}
      </div>
    </div>
  `;
}

function renderBringItemStatus(status) {
  if (!status?.message) return "";
  return `<span class="bring-status ${status.kind === "error" ? "is-error" : "is-success"}">${escapeHtml(status.message)}</span>`;
}

async function addShoppingItemToBring(button) {
  const itemId = button.dataset.addBringItem;
  const item = currentShoppingGroups.flatMap((group) => group.items).find((candidate) => candidate.id === itemId);
  if (!item) return;

  const editor = button.closest(".bring-editor");
  const name = editor?.querySelector("[data-bring-name]")?.value.trim() ?? "";
  const specification = editor?.querySelector("[data-bring-specification]")?.value.trim() ?? "";
  state.bringItemDrafts[itemId] = { name, specification };
  if (!name) {
    state.bringItemStatus[itemId] = { kind: "error", message: "Add a name first" };
    renderCurrentShoppingList();
    return;
  }

  button.disabled = true;
  button.textContent = "Adding...";

  try {
    const response = await fetch(`${apiBase}/bring/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, specification }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new Error(result.message || "Could not add to Bring");
    }
    state.bringItemStatus[itemId] = { kind: "success", message: `Added to ${result.listName || "Bring"}` };
    if (state.activeBringItemId === itemId) state.activeBringItemId = "";
  } catch (error) {
    state.bringItemStatus[itemId] = { kind: "error", message: error.message || "Bring add failed" };
  }

  renderCurrentShoppingList();
}

function openShoppingRecipe(recipeId, sourceUrl, title) {
  if (!recipeId) {
    if (sourceUrl) openSourceOverlay(sourceUrl, title);
    return;
  }

  const recipe = state.recipes.find((candidate) => candidate.id === recipeId);
  if (!recipe) {
    if (sourceUrl) openSourceOverlay(sourceUrl, title);
    return;
  }

  openQuickRecipeOverlay(recipe);
}

function openQuickRecipeOverlay(recipe) {
  if (!controls.quickRecipeOverlay || !controls.quickRecipeTitle || !controls.quickRecipeContent) return;

  controls.quickRecipeTitle.textContent = getRecipeDisplayTitle(recipe);
  controls.quickRecipeContent.innerHTML = renderQuickRecipeDetails(recipe);
  controls.quickRecipeOverlay.classList.remove("is-hidden");
  controls.quickRecipeOverlay.setAttribute("aria-hidden", "false");
  controls.closeQuickRecipeOverlay?.focus();
}

function closeQuickRecipeOverlay() {
  if (!controls.quickRecipeOverlay || !controls.quickRecipeContent) return;

  controls.quickRecipeOverlay.classList.add("is-hidden");
  controls.quickRecipeOverlay.setAttribute("aria-hidden", "true");
  controls.quickRecipeContent.innerHTML = "";
}

function generate({ keepShoppingEdits = false, preserveDays = new Set(), randomness = 0, carryPreviousMonday = false } = {}) {
  if (!keepShoppingEdits) {
    state.removedShoppingItemIds.clear();
    state.shoppingItemAssignments.clear();
  }

  const plan = buildPlan({
    recipes: state.recipes,
    days: dinnerDays,
    inspiration: state.inspiration,
    weekMood: state.weekMood,
    busyDays: state.busyDays,
    lunchDays: state.lunchDays,
    snackDessertDays: state.snackDessertDays,
    noCookDays: state.noCookDays,
    excludedRecipeIdsBySlot: state.excludedRecipeIdsBySlot,
    recipeFeedback: state.recipeFeedback,
    cookingHistory: state.cookingHistory,
    randomness,
  });

  state.plan = applyPlanOverrides(plan, preserveDays);
  if (carryPreviousMonday) applyPriorNextMondayCarryover();

  renderPlan(state.plan);
  renderCurrentShoppingList();
}

function startFreshWeek() {
  const freshWeekExclusions = getFreshWeekExclusions();
  resetPlanningDefaults();
  state.plan = null;
  state.savedPlan = null;
  state.activeSavedWeekId = "";
  state.recentlyLoadedSavedWeekId = "";
  state.lockedDays.clear();
  state.excludedRecipeIdsBySlot.clear();
  applyFreshWeekExclusions(freshWeekExclusions);
  state.excludedAddOnSuggestionIdsBySlot.clear();
  state.addOnSuggestionIdsBySlot.clear();
  state.activeAdders = {};
  state.activeMealChoosers.clear();
  state.visibleMealOptions.clear();
  state.openPlanReviewSections.clear();
  state.dayNotes = {};
  state.dayDishes = {};
  state.manualShoppingItems = {};
  localStorage.setItem(storageKeys.lockedDays, JSON.stringify([]));
  localStorage.removeItem(storageKeys.currentPlan);
  saveSharedState();
  saveObject(storageKeys.dayNotes, state.dayNotes);
  saveObject(storageKeys.dayDishes, state.dayDishes);
  saveObject(storageKeys.manualShoppingItems, state.manualShoppingItems);
  renderPlanningToggles();
  renderSavedWeeksList();
  generate({ randomness: 8, carryPreviousMonday: true });
}

function switchPlanningWeek(weekStart) {
  if (!weekStart || weekStart === state.selectedWeekStart) return;

  saveCurrentWeekDraft();
  state.selectedWeekStart = weekStart;
  localStorage.setItem(storageKeys.selectedWeekStart, state.selectedWeekStart);
  loadSelectedWeekDraft();
}

function shiftPlanningWeek(weeks) {
  switchPlanningWeek(addDaysToKey(state.selectedWeekStart, weeks * 7));
}

function loadSelectedWeekDraft() {
  const draft = state.weekDrafts[state.selectedWeekStart];
  clearTransientPlanState();

  if (!draft) {
    startFreshWeek();
    return;
  }

  state.savedPlan = draft.plan ?? null;
  state.plan = hydratePlan(draft.plan);
  state.dayDishes = cloneJson(draft.dayDishes) ?? {};
  state.dayNotes = cloneJson(draft.dayNotes) ?? {};
  state.manualShoppingItems = cloneJson(draft.manualShoppingItems) ?? {};
  state.lockedDays = new Set(draft.lockedDays ?? []);
  state.busyDays = new Set(draft.busyDays ?? ["Monday", "Tuesday", "Wednesday"]);
  state.noCookDays = new Set(draft.noCookDays ?? []);
  state.lunchDays = new Set(draft.lunchDays ?? []);
  state.snackDessertDays = new Set(draft.snackDessertDays ?? ["Friday", "Saturday", "Sunday"]);
  state.inspiration = draft.inspiration ?? "none";
  state.weekMood = draft.weekMood ?? "balanced";
  controls.inspiration.value = state.inspiration;
  controls.weekMood.value = state.weekMood;
  persistActiveWeekStateLocally();
  renderPlanningToggles();
  renderSavedWeeksList();

  if (state.plan) {
    renderPlan(state.plan);
    renderCurrentShoppingList();
  } else {
    generate({ carryPreviousMonday: true });
  }
}

function clearTransientPlanState() {
  state.excludedRecipeIdsBySlot.clear();
  state.excludedAddOnSuggestionIdsBySlot.clear();
  state.addOnSuggestionIdsBySlot.clear();
  state.activeAdders = {};
  state.activeMealChoosers.clear();
  state.visibleMealOptions.clear();
  state.openPlanReviewSections.clear();
}

function persistActiveWeekStateLocally() {
  localStorage.setItem(storageKeys.currentPlan, JSON.stringify(state.savedPlan));
  localStorage.setItem(storageKeys.dayDishes, JSON.stringify(state.dayDishes));
  localStorage.setItem(storageKeys.dayNotes, JSON.stringify(state.dayNotes));
  localStorage.setItem(storageKeys.manualShoppingItems, JSON.stringify(state.manualShoppingItems));
  localStorage.setItem(storageKeys.lockedDays, JSON.stringify([...state.lockedDays]));
  localStorage.setItem(storageKeys.selectedWeekStart, state.selectedWeekStart);
}

function applyPriorNextMondayCarryover() {
  if (!state.plan || !state.selectedWeekStart) return;

  const previousWeekStart = addDaysToKey(state.selectedWeekStart, -7);
  const previousDraft = state.weekDrafts[previousWeekStart];
  if (!previousDraft?.plan) return;

  const previousPlan = hydratePlan(previousDraft.plan);
  const sourceDay = previousPlan?.days?.find((day) => day.label === "Next Monday");
  if (!sourceDay || !hasPlannedDayContent(sourceDay, previousDraft, "Next Monday")) return;

  const mondayIndex = state.plan.days.findIndex((day) => day.label === "Monday");
  if (mondayIndex < 0) return;

  state.plan.days[mondayIndex] = {
    ...sourceDay,
    label: "Monday",
    reason: "Carried over from previous week",
    carriedFromPreviousWeek: true,
  };

  copyDraftDayExtras(previousDraft, "Next Monday", "Monday");
  state.lockedDays.add("Monday");
}

function hasPlannedDayContent(day, draft, dayLabel) {
  if (day.lunch || day.dinner || day.side || day.snackDessert) return true;
  if (day.customLunch || day.customDinner || day.customSnackDessert) return true;
  if ((draft.dayDishes?.[dayLabel] ?? []).length) return true;
  return ["lunch", "dinner", "snackDessert"].some((mealType) =>
    Boolean(draft.dayNotes?.[getMealKey(dayLabel, mealType)] || draft.manualShoppingItems?.[getMealKey(dayLabel, mealType)]),
  );
}

function copyDraftDayExtras(draft, sourceLabel, targetLabel) {
  const sourceDishes = draft.dayDishes?.[sourceLabel];
  if (sourceDishes?.length) {
    state.dayDishes[targetLabel] = cloneJson(sourceDishes).map((dish) => ({
      ...dish,
      id: dish.id ? dish.id.replace(sourceLabel, targetLabel) : `dish-${targetLabel}-${Date.now()}`,
    }));
  }

  ["lunch", "dinner", "snackDessert"].forEach((mealType) => {
    const sourceKey = getMealKey(sourceLabel, mealType);
    const targetKey = getMealKey(targetLabel, mealType);
    if (draft.dayNotes?.[sourceKey]) state.dayNotes[targetKey] = draft.dayNotes[sourceKey];
    if (draft.manualShoppingItems?.[sourceKey]) state.manualShoppingItems[targetKey] = draft.manualShoppingItems[sourceKey];
  });

  if (draft.dayNotes?.[sourceLabel]) state.dayNotes[targetLabel] = draft.dayNotes[sourceLabel];
}

function getFreshWeekExclusions() {
  const exclusions = {
    dinner: new Set(),
    lunch: new Set(),
    snackDessert: new Set(),
  };

  (state.plan?.days ?? []).forEach((day) => {
    [
      ["dinner", day.dinner, day.dinnerOptions],
      ["lunch", day.lunch, day.lunchOptions],
      ["snackDessert", day.snackDessert, day.snackDessertOptions],
    ].forEach(([mealType, selectedRecipe, optionRecipes = []]) => {
      if (selectedRecipe?.id) exclusions[mealType].add(selectedRecipe.id);
      optionRecipes.forEach((recipe) => {
        if (recipe?.id) exclusions[mealType].add(recipe.id);
      });
    });
  });

  return exclusions;
}

function applyFreshWeekExclusions(exclusions) {
  dinnerDays.forEach((dayLabel) => {
    Object.entries(exclusions).forEach(([mealType, recipeIds]) => {
      if (!recipeIds.size) return;
      state.excludedRecipeIdsBySlot.set(`${dayLabel}:${mealType}`, new Set(recipeIds));
    });
  });
}

function resetPlanningDefaults() {
  state.busyDays = new Set(["Monday", "Tuesday", "Wednesday"]);
  state.noCookDays = new Set();
  state.lunchDays = new Set();
  state.snackDessertDays = new Set(["Friday", "Saturday", "Sunday"]);
  state.inspiration = "none";
  state.weekMood = "balanced";
  controls.inspiration.value = state.inspiration;
  controls.weekMood.value = state.weekMood;
}

function applyPlanOverrides(nextPlan, preserveDays = new Set()) {
  const previousDays = new Map((state.plan?.days ?? []).map((day) => [day.label, day]));

  return {
    days: nextPlan.days.map((day) => {
      const previousDay = previousDays.get(day.label);
      if (preserveDays.has(day.label) && previousDay) return previousDay;
      if (state.lockedDays.has(day.label) && previousDay) return previousDay;

      const customLunch = getMealNote(day.label, "lunch");
      const customDinner = getMealNote(day.label, "dinner");
      const customSnackDessert = getMealNote(day.label, "snackDessert");

      return {
        ...day,
        customLunch: customLunch || null,
        customDinner: customDinner || null,
        customSnackDessert: customSnackDessert || null,
        lunch: customLunch ? null : day.lunch,
        lunchOptions: customLunch ? [] : day.lunchOptions,
        dinner: customDinner ? null : day.dinner,
        dinnerOptions: customDinner ? [] : day.dinnerOptions,
        side: customDinner ? null : day.side,
        snackDessert: customSnackDessert ? null : day.snackDessert,
        snackDessertOptions: customSnackDessert ? [] : day.snackDessertOptions,
        reason: customLunch || customDinner || customSnackDessert ? "Includes manual note" : day.reason,
      };
    }),
  };
}

function renderCurrentShoppingList() {
  if (!state.plan) return;

  renderShopping(
    splitShoppingList({
      plan: state.plan,
      shoppingDays: [...state.shoppingDays],
      itemAssignments: state.shoppingItemAssignments,
      removedItemIds: state.removedShoppingItemIds,
      manualShoppingItems: state.manualShoppingItems,
      dayDishes: state.dayDishes,
      recipesById: new Map(state.recipes.map((recipe) => [recipe.id, recipe])),
    }),
  );
}

function sanitizeAutomaticSides(plan) {
  (plan?.days ?? []).forEach((day) => {
    if (day.side && !isAutomaticSideCandidate(day.side, day.dinner)) {
      day.side = null;
    }
  });
}

function regenerateMeal(dayLabel, mealType) {
  if (state.lockedDays.has(dayLabel)) return;

  const day = state.plan?.days.find((plannedDay) => plannedDay.label === dayLabel);
  if (!day) return;
  const currentRecipe = day?.[mealType];

  if (mealType === "side" && day.dinner) {
    if (!currentRecipe) return;
    const slot = `${dayLabel}:side`;
    const excludedRecipeIds = state.excludedRecipeIdsBySlot.get(slot) ?? new Set();
    excludedRecipeIds.add(currentRecipe.id);
    state.excludedRecipeIdsBySlot.set(slot, excludedRecipeIds);
    day.side = chooseSideForMain(day.dinner, excludedRecipeIds);
    renderPlan(state.plan);
    renderCurrentShoppingList();
    return;
  }

  const slot = `${dayLabel}:${mealType}`;
  const excludedRecipeIds = state.excludedRecipeIdsBySlot.get(slot) ?? new Set();
  if (currentRecipe) excludedRecipeIds.add(currentRecipe.id);
  (day[`${mealType}Options`] ?? []).forEach((recipe) => excludedRecipeIds.add(recipe.id));
  state.excludedRecipeIdsBySlot.set(slot, excludedRecipeIds);

  const options = buildMealOptions({
    recipes: state.recipes,
    label: dayLabel,
    mealType,
    inspiration: state.inspiration,
    busy: day.busy,
    recipeFeedback: state.recipeFeedback,
    cookingHistory: state.cookingHistory,
    weekMood: state.weekMood,
    excludedRecipeIds,
    usedRecipeIds: getUsedRecipeIdsExcept(dayLabel, mealType),
    randomness: 3,
  });
  if (!options.length) return;

  day[`${mealType}Options`] = options;
  renderPlan(state.plan);
  renderCurrentShoppingList();
}

function getUsedRecipeIdsExcept(dayLabel, mealType) {
  const usedRecipeIds = new Set();

  (state.plan?.days ?? []).forEach((day) => {
    [
      ["lunch", day.lunch],
      ["dinner", day.dinner],
      ["snackDessert", day.snackDessert],
      ["side", day.side],
    ].forEach(([slot, recipe]) => {
      if (!recipe) return;
      if (day.label === dayLabel && slot === mealType) return;
      if (day.label === dayLabel && mealType === "dinner" && slot === "side") return;
      usedRecipeIds.add(recipe.id);
    });
  });

  return usedRecipeIds;
}

function selectMealOption(dayLabel, mealType, recipeId) {
  if (state.lockedDays.has(dayLabel)) return;

  const day = state.plan?.days.find((plannedDay) => plannedDay.label === dayLabel);
  const recipe = state.recipes.find((candidate) => candidate.id === recipeId);
  if (!day || !recipe) return;

  day[mealType] = recipe;
  const mealKey = getMealKey(dayLabel, mealType);
  state.activeMealChoosers.delete(mealKey);
  state.visibleMealOptions.delete(mealKey);
  if (mealType === "dinner") {
    day.side = recipe.recipeRole === "main" ? chooseSideForMain(recipe) : null;
  }

  renderPlan(state.plan);
  renderCurrentShoppingList();
}

function regenerateDay(dayLabel) {
  if (state.lockedDays.has(dayLabel)) return;

  const day = state.plan?.days.find((plannedDay) => plannedDay.label === dayLabel);
  if (day?.dinner) {
    const excludedDinnerIds = state.excludedRecipeIdsBySlot.get(`${dayLabel}:dinner`) ?? new Set();
    excludedDinnerIds.add(day.dinner.id);
    state.excludedRecipeIdsBySlot.set(`${dayLabel}:dinner`, excludedDinnerIds);
  }
  if (day?.lunch) {
    const excludedLunchIds = state.excludedRecipeIdsBySlot.get(`${dayLabel}:lunch`) ?? new Set();
    excludedLunchIds.add(day.lunch.id);
    state.excludedRecipeIdsBySlot.set(`${dayLabel}:lunch`, excludedLunchIds);
  }
  if (day?.snackDessert) {
    const excludedSnackDessertIds = state.excludedRecipeIdsBySlot.get(`${dayLabel}:snackDessert`) ?? new Set();
    excludedSnackDessertIds.add(day.snackDessert.id);
    state.excludedRecipeIdsBySlot.set(`${dayLabel}:snackDessert`, excludedSnackDessertIds);
  }

  state.dayNotes[dayLabel] = "";
  saveObject(storageKeys.dayNotes, state.dayNotes);
  state.excludedRecipeIdsBySlot.delete(`${dayLabel}:side`);
  generate({
    keepShoppingEdits: true,
    preserveDays: new Set(dinnerDays.filter((label) => label !== dayLabel)),
    randomness: 5,
  });
}

function selectRecipe(dayLabel, mealType, recipeId) {
  if (state.lockedDays.has(dayLabel)) return;

  const recipe = state.recipes.find((candidate) => candidate.id === recipeId);
  const day = state.plan?.days.find((plannedDay) => plannedDay.label === dayLabel);
  if (!recipe || !day || day.noCook) return;

  day[mealType] = recipe;
  const mealKey = getMealKey(dayLabel, mealType);
  state.activeMealChoosers.delete(mealKey);
  state.visibleMealOptions.delete(mealKey);
  if (mealType === "dinner") {
    day.reason = "Chosen manually";
    day.side = recipe.recipeRole === "main" ? chooseSideForMain(recipe) : null;
  }
  renderPlan(state.plan);
  renderCurrentShoppingList();
}

function toggleMealChooser(dayLabel, mealType) {
  const mealKey = getMealKey(dayLabel, mealType);
  if (state.activeMealChoosers.has(mealKey)) state.activeMealChoosers.delete(mealKey);
  else state.activeMealChoosers.add(mealKey);
  renderPlan(state.plan);
}

function openManualMealEdit(dayLabel, mealType) {
  state.activeMealChoosers.add(getMealKey(dayLabel, mealType));
  renderPlan(state.plan);
}

function closeManualMealEdit(dayLabel, mealType) {
  state.activeMealChoosers.delete(getMealKey(dayLabel, mealType));
  renderPlan(state.plan);
}

function toggleMealOptions(dayLabel, mealType) {
  const mealKey = getMealKey(dayLabel, mealType);
  if (state.visibleMealOptions.has(mealKey)) state.visibleMealOptions.delete(mealKey);
  else state.visibleMealOptions.add(mealKey);
  renderPlan(state.plan);
}

function openAddDishChooser(dayLabel, mealType, role) {
  state.activeAdders[getMealKey(dayLabel, mealType)] = role;
  renderPlan(state.plan);
}

function closeAddDishChooser(dayLabel, mealType) {
  const role = state.activeAdders[getMealKey(dayLabel, mealType)];
  if (role) state.addOnSuggestionIdsBySlot.delete(getAddOnSuggestionKey(dayLabel, mealType, role));
  delete state.activeAdders[getMealKey(dayLabel, mealType)];
  renderPlan(state.plan);
}

function getAddOnSuggestionKey(dayLabel, mealType, role) {
  return `${getMealKey(dayLabel, mealType)}:${role}`;
}

function regenerateAddOnSuggestions(dayLabel, mealType, role) {
  if (state.lockedDays.has(dayLabel)) return;

  const day = state.plan?.days.find((plannedDay) => plannedDay.label === dayLabel);
  if (!day) return;

  const key = getAddOnSuggestionKey(dayLabel, mealType, role);
  const excludedRecipeIds = state.excludedAddOnSuggestionIdsBySlot.get(key) ?? new Set();
  getSuggestedRecipes(day, role, mealType, 3).forEach((recipe) => excludedRecipeIds.add(recipe.id));
  state.excludedAddOnSuggestionIdsBySlot.set(key, excludedRecipeIds);
  state.addOnSuggestionIdsBySlot.delete(key);
  if (!getSuggestedRecipes(day, role, mealType, 3).length) {
    state.excludedAddOnSuggestionIdsBySlot.delete(key);
    state.addOnSuggestionIdsBySlot.delete(key);
  }
  renderPlan(state.plan);
  renderCurrentShoppingList();
}

function addManualDish(dayLabel, mealType, role, title, shoppingItems = "") {
  if (state.lockedDays.has(dayLabel) || !title?.trim()) return;

  addDish(dayLabel, {
    id: crypto.randomUUID(),
    mealType,
    role,
    source: "manual",
    title: title.trim(),
    shoppingItems: shoppingItems.trim(),
  });
  closeAddDishChooser(dayLabel, mealType);
}

function addRecipeDish(dayLabel, mealType, role, recipeId) {
  if (state.lockedDays.has(dayLabel)) return;

  const recipe = state.recipes.find((candidate) => candidate.id === recipeId);
  if (!recipe) return;

  addDish(dayLabel, {
    id: crypto.randomUUID(),
    mealType,
    role,
    source: "recipe",
    recipeId: recipe.id,
    title: getRecipeDisplayTitle(recipe),
  });
  closeAddDishChooser(dayLabel, mealType);
}

function getSuggestedRecipes(day, role, mealType = "dinner", limit = 3) {
  const suggestionKey = getAddOnSuggestionKey(day.label, mealType, role);
  const cachedSuggestionIds = state.addOnSuggestionIdsBySlot.get(suggestionKey);
  if (cachedSuggestionIds?.length) {
    const cachedRecipes = cachedSuggestionIds
      .map((recipeId) => state.recipes.find((recipe) => recipe.id === recipeId))
      .filter(Boolean)
      .filter((recipe) => !isRecipeHidden(recipe))
      .filter((recipe) => getRepeatPreference(recipe) !== "avoid");
    if (cachedRecipes.length) return cachedRecipes.slice(0, limit);
  }

  const excludedSuggestionIds = state.excludedAddOnSuggestionIdsBySlot.get(
    suggestionKey,
  ) ?? new Set();
  const existingRecipeIds = new Set([
    day.dinner?.id,
    day.lunch?.id,
    day.side?.id,
    ...(state.dayDishes[day.label] ?? [])
      .filter((dish) => dish.source === "recipe")
      .map((dish) => dish.recipeId),
  ].filter(Boolean));
  const anchorRecipe = mealType === "lunch" ? day.lunch : day.dinner;
  const mainTags = new Set(anchorRecipe?.pairingTags ?? []);
  const mainCuisineTags = anchorRecipe ? getCuisineTags(anchorRecipe) : new Set();

  const candidates = state.recipes
    .filter((recipe) => !isRecipeHidden(recipe))
    .filter((recipe) => !existingRecipeIds.has(recipe.id))
    .filter((recipe) => !excludedSuggestionIds.has(recipe.id))
    .filter((recipe) => getRepeatPreference(recipe) !== "avoid")
    .map((recipe) => ({
      recipe,
      score: scoreAddOnRecipe(recipe, role, mainTags, mainCuisineTags),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || getRecipeDisplayTitle(a.recipe).localeCompare(getRecipeDisplayTitle(b.recipe)));

  const suggestions = chooseVariedAddOnSuggestions(candidates, limit);
  state.addOnSuggestionIdsBySlot.set(suggestionKey, suggestions.map((recipe) => recipe.id));
  return suggestions;
}

function chooseVariedAddOnSuggestions(candidates, limit) {
  const shortlist = candidates.slice(0, Math.max(limit * 4, 8));
  const selected = [];
  const selectedRecipeIds = new Set();

  while (selected.length < limit && shortlist.length) {
    const pickIndex = Math.floor(Math.random() * Math.min(shortlist.length, 6));
    const [candidate] = shortlist.splice(pickIndex, 1);
    if (!candidate || selectedRecipeIds.has(candidate.recipe.id)) continue;
    selected.push(candidate.recipe);
    selectedRecipeIds.add(candidate.recipe.id);
  }

  candidates.forEach((candidate) => {
    if (selected.length >= limit) return;
    if (selectedRecipeIds.has(candidate.recipe.id)) return;
    selected.push(candidate.recipe);
    selectedRecipeIds.add(candidate.recipe.id);
  });

  return selected;
}

function getMealKey(dayLabel, mealType) {
  return `${dayLabel}:${mealType}`;
}

function scoreAddOnRecipe(recipe, role, mainTags, mainCuisineTags = new Set()) {
  const title = recipe.title.toLowerCase();
  const tags = new Set(recipe.pairingTags ?? []);
  const addOnRoles = new Set(getAddOnRoles(recipe));
  const cuisineTags = getCuisineTags(recipe);
  let score = 0;

  if (isAddOnRecipe(recipe)) score += 3;
  if (addOnRoles.has(role)) score += 8;
  if (role === "side" && isAddOnRecipe(recipe)) score += 5;
  if (role === "appetizer" && /appetizer|starter|dip|canape|snack/.test(title)) score += 7;
  if (role === "salad" && (title.includes("salad") || tags.has("fresh"))) score += 8;
  if (role === "vegetable" && tags.has("vegetable")) score += 7;
  if (role === "carb" && (tags.has("pasta") || /rice|bread|noodle|potato|pasta/.test(title))) score += 7;
  if (role === "protein" && (tags.has("seafood") || tags.has("hearty") || /chicken|beef|pork|tofu|egg|salmon|shrimp/.test(title))) score += 7;
  if (recipe.effort === "low") score += 2;
  [...tags].forEach((tag) => {
    if (mainTags.has(tag)) score += 1;
  });
  if (mainCuisineTags.size) {
    if (cuisineTags.has("flexibleCuisine")) score += 3;
    if (cuisineTags.has("asian") && mainCuisineTags.has("asian")) score += 8;
    if (cuisineTags.has("western") && mainCuisineTags.has("western")) score += 8;
    if (cuisineTags.has("asian") && mainCuisineTags.has("western")) score -= 4;
    if (cuisineTags.has("western") && mainCuisineTags.has("asian")) score -= 4;
  }

  return score;
}

function addDish(dayLabel, dish) {
  const dishes = state.dayDishes[dayLabel] ?? [];
  dishes.push(dish);
  state.dayDishes[dayLabel] = dishes;
  saveObject(storageKeys.dayDishes, state.dayDishes);
  renderPlan(state.plan);
  renderCurrentShoppingList();
}

function removeDish(dayLabel, dishId) {
  if (state.lockedDays.has(dayLabel)) return;

  state.dayDishes[dayLabel] = (state.dayDishes[dayLabel] ?? []).filter((dish) => dish.id !== dishId);
  if (state.dayDishes[dayLabel].length === 0) delete state.dayDishes[dayLabel];
  saveObject(storageKeys.dayDishes, state.dayDishes);
  renderPlan(state.plan);
  renderCurrentShoppingList();
}

function removeAutomaticSide(dayLabel) {
  if (state.lockedDays.has(dayLabel)) return;

  const day = state.plan?.days.find((plannedDay) => plannedDay.label === dayLabel);
  if (!day) return;

  day.side = null;
  renderPlan(state.plan);
  renderCurrentShoppingList();
}

function findByData(key, value) {
  return [...controls.menuPlan.querySelectorAll(`[data-${toKebabCase(key)}]`)].find(
    (element) => element.dataset[key] === value,
  );
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function getMealNote(dayLabel, mealType) {
  const mealKey = getMealKey(dayLabel, mealType);
  if (state.dayNotes[mealKey]) return state.dayNotes[mealKey].trim();
  if (mealType === "dinner" && state.dayNotes[dayLabel]) return state.dayNotes[dayLabel].trim();
  return "";
}

function getManualShoppingItems(dayLabel, mealType) {
  return state.manualShoppingItems[getMealKey(dayLabel, mealType)]?.trim() ?? "";
}

function setManualShoppingItems(dayLabel, mealType, value) {
  const items = value.trim();
  const mealKey = getMealKey(dayLabel, mealType);

  if (items) state.manualShoppingItems[mealKey] = items;
  else delete state.manualShoppingItems[mealKey];

  saveObject(storageKeys.manualShoppingItems, state.manualShoppingItems);
  renderCurrentShoppingList();
}

function setDayNote(dayLabel, mealType, value) {
  const note = value.trim();
  const mealKey = getMealKey(dayLabel, mealType);

  if (note) state.dayNotes[mealKey] = note;
  else delete state.dayNotes[mealKey];
  if (mealType === "dinner") delete state.dayNotes[dayLabel];
  if (!note) delete state.manualShoppingItems[mealKey];
  state.activeMealChoosers.delete(mealKey);
  state.visibleMealOptions.delete(mealKey);

  saveObject(storageKeys.dayNotes, state.dayNotes);
  saveObject(storageKeys.manualShoppingItems, state.manualShoppingItems);
  generate({
    keepShoppingEdits: true,
    preserveDays: new Set(dinnerDays.filter((label) => label !== dayLabel)),
  });
}

function setDayLock(dayLabel, isLocked) {
  if (isLocked) state.lockedDays.add(dayLabel);
  else state.lockedDays.delete(dayLabel);

  localStorage.setItem(storageKeys.lockedDays, JSON.stringify([...state.lockedDays]));
  saveSharedState();
  renderPlan(state.plan);
}

function setCookingHistoryStatus(status, reviewKey) {
  const item = (state.plan?.days ?? [])
    .flatMap((day) => getReviewItems(day))
    .find((candidate) => candidate.key === reviewKey);
  if (!item) return;

  if (state.cookingHistory[reviewKey]?.status === status) {
    delete state.cookingHistory[reviewKey];
    saveObject(storageKeys.cookingHistory, state.cookingHistory);
    renderPlan(state.plan);
    return;
  }

  state.cookingHistory[reviewKey] = {
    status,
    plannedFor: item.plannedFor,
    dayLabel: item.dayLabel,
    mealType: item.mealType,
    role: item.role,
    title: item.title,
    source: item.source,
    recipeId: item.recipeId,
    updatedAt: new Date().toISOString(),
  };
  saveObject(storageKeys.cookingHistory, state.cookingHistory);
  renderPlan(state.plan);
}

function updateRecipeFeedback(control) {
  const recipeId = control.dataset.feedbackRecipe;
  const field = control.dataset.feedbackField;
  const feedback = state.recipeFeedback[recipeId] ?? {};

  if (control.type === "checkbox") feedback[field] = control.checked;
  else if (field === "displayTitle") {
    const recipe = state.recipes.find((candidate) => candidate.id === recipeId);
    const value = control.value.trim();
    if (!value || value === recipe?.title) delete feedback.displayTitle;
    else feedback.displayTitle = value;
  } else feedback[field] = control.value;
  if (field !== "reviewed") feedback.reviewed = true;

  state.recipeFeedback[recipeId] = feedback;
  saveObject(storageKeys.recipeFeedback, state.recipeFeedback);
}

function updateRecipeMemoryTag(control) {
  const recipeId = control.dataset.feedbackRecipe;
  const tag = control.dataset.feedbackTagValue;
  const feedback = state.recipeFeedback[recipeId] ?? {};
  const recipe = state.recipes.find((candidate) => candidate.id === recipeId);
  const defaultTags = new Set(recipe?.defaultTags ?? []);
  const tags = new Set(feedback.tags ?? []);
  const suppressedTags = new Set(feedback.suppressedTags ?? []);
  const aliases = getTagAliases(tag);

  if (control.checked) {
    aliases.forEach((alias) => suppressedTags.delete(alias));
    tags.add(tag);
  } else {
    aliases.forEach((alias) => {
      tags.delete(alias);
      suppressedTags.add(alias);
    });
  }

  feedback.tags = [...tags];
  feedback.suppressedTags = [...suppressedTags];
  feedback.reviewed = true;
  state.recipeFeedback[recipeId] = feedback;
  saveObject(storageKeys.recipeFeedback, state.recipeFeedback);
}

function getTagAliases(tag) {
  const aliases = {
    handsOn: ["handsOn", "needsTime"],
    needsTime: ["needsTime", "handsOn"],
    keeps: ["keeps", "canMakeAhead"],
    canMakeAhead: ["canMakeAhead", "keeps"],
  };

  return aliases[tag] ?? [tag];
}

function updateRecipeRole(control) {
  const recipeId = control.dataset.feedbackRecipe;
  const role = control.dataset.feedbackRoleValue;
  const recipe = state.recipes.find((candidate) => candidate.id === recipeId);
  const feedback = state.recipeFeedback[recipeId] ?? {};
  const roles = new Set(Array.isArray(feedback.roles) ? feedback.roles : recipe ? getEffectiveRoles(recipe) : []);

  if (control.checked) roles.add(role);
  else roles.delete(role);

  feedback.roles = [...roles];
  feedback.reviewed = true;
  state.recipeFeedback[recipeId] = feedback;
  saveObject(storageKeys.recipeFeedback, state.recipeFeedback);
}

function updateRecipeAddOnRole(control) {
  const recipeId = control.dataset.feedbackRecipe;
  const addOnRole = control.dataset.feedbackAddonRoleValue;
  const recipe = state.recipes.find((candidate) => candidate.id === recipeId);
  const feedback = state.recipeFeedback[recipeId] ?? {};
  const addOnRoles = new Set(Array.isArray(feedback.addOnRoles) ? feedback.addOnRoles : recipe ? getAddOnRoles(recipe) : ["side"]);

  if (control.checked) addOnRoles.add(addOnRole);
  else addOnRoles.delete(addOnRole);
  if (addOnRoles.size === 0) addOnRoles.add("side");

  feedback.addOnRoles = [...addOnRoles];
  delete feedback.addOnRole;
  feedback.reviewed = true;
  state.recipeFeedback[recipeId] = feedback;
  saveObject(storageKeys.recipeFeedback, state.recipeFeedback);
}

function chooseSideForMain(mainRecipe, excludedRecipeIds = new Set()) {
  const mainTags = new Set(mainRecipe.pairingTags ?? []);

  return state.recipes
    .filter((recipe) => isAutomaticSideCandidate(recipe, mainRecipe))
    .filter((recipe) => !excludedRecipeIds.has(recipe.id))
    .map((recipe) => {
      const sideTags = recipe.pairingTags ?? [];
      let score = sideTags.filter((tag) => mainTags.has(tag)).length * 3;
      if (sideTags.includes("fresh") && mainTags.has("creamy")) score += 3;
      if (sideTags.includes("vegetable")) score += 2;
      if (recipe.effort === "low") score += 2;
      return { recipe, score };
    })
    .sort((a, b) => b.score - a.score || getRecipeDisplayTitle(a.recipe).localeCompare(getRecipeDisplayTitle(b.recipe)))[0]?.recipe ?? null;
}

function isAutomaticSideCandidate(recipe, mainRecipe) {
  if (!recipe || !mainRecipe) return false;
  if (recipe.id === mainRecipe.id) return false;
  if (getRecipeDisplayTitle(recipe).toLowerCase() === getRecipeDisplayTitle(mainRecipe).toLowerCase()) return false;
  if (!isAddOnRecipe(recipe)) return false;
  if (!getAddOnRoles(recipe).some((role) => ["side", "salad", "vegetable", "carb"].includes(role))) return false;
  if (isRecipeHidden(recipe)) return false;
  return getRepeatPreference(recipe) !== "avoid";
}

controls.inspiration.addEventListener("change", () => {
  state.inspiration = controls.inspiration.value;
  generate();
});

controls.weekMood.addEventListener("change", () => {
  state.weekMood = controls.weekMood.value;
  generate();
});

controls.previousWeekButton?.addEventListener("click", () => {
  shiftPlanningWeek(-1);
});

controls.nextWeekButton?.addEventListener("click", () => {
  shiftPlanningWeek(1);
});

controls.currentWeekButton?.addEventListener("click", () => {
  switchPlanningWeek(getCurrentWeekStartKey());
});

controls.startFreshWeekButton?.addEventListener("click", () => {
  startFreshWeek();
});

controls.saveWeekButton?.addEventListener("click", () => {
  saveWeekSnapshot();
  showTemporaryButtonText(controls.saveWeekButton, "Saved");
});

controls.viewTabs.forEach((button) => {
  button.addEventListener("click", () => {
    state.activeView = button.dataset.viewTab;
    renderActiveView();
  });
});

controls.recipeLibrarySearch.addEventListener("input", () => {
  state.recipeSearch = controls.recipeLibrarySearch.value;
  renderRecipesView();
});

controls.recipeLibraryFilter.addEventListener("change", () => {
  state.recipeFilter = controls.recipeLibraryFilter.value;
  renderRecipesView();
});

controls.importButton.addEventListener("click", () => {
  updateRecipesFromImports();
});

controls.closeSourceOverlay?.addEventListener("click", () => {
  closeSourceOverlay();
});

controls.closeQuickRecipeOverlay?.addEventListener("click", () => {
  closeQuickRecipeOverlay();
});

controls.quickRecipeOverlay?.addEventListener("click", (event) => {
  if (event.target === controls.quickRecipeOverlay) closeQuickRecipeOverlay();
});

controls.sourceOverlay?.addEventListener("click", (event) => {
  if (event.target === controls.sourceOverlay) closeSourceOverlay();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !controls.quickRecipeOverlay?.classList.contains("is-hidden")) {
    closeQuickRecipeOverlay();
    return;
  }

  if (event.key === "Escape" && !controls.sourceOverlay?.classList.contains("is-hidden")) {
    closeSourceOverlay();
  }
});

function renderPlanningToggles() {
  renderToggleGroup(controls.busyDays, dinnerDays, state.busyDays, generate, state.noCookDays);
  renderToggleGroup(controls.noCookDays, dinnerDays, state.noCookDays, handleNoCookDaysChanged);
  renderToggleGroup(controls.lunchDays, dinnerDays, state.lunchDays, generate);
  renderToggleGroup(controls.snackDessertDays, dinnerDays, state.snackDessertDays, generate);
  renderToggleGroup(controls.shoppingDays, dinnerDays, state.shoppingDays, handleShoppingDaysChanged);
}

function handleNoCookDaysChanged() {
  state.noCookDays.forEach((day) => {
    state.busyDays.delete(day);
  });
  renderPlanningToggles();
  generate();
}

function handleShoppingDaysChanged() {
  localStorage.setItem(storageKeys.shoppingDays, JSON.stringify([...state.shoppingDays]));
  saveSharedState();
  renderCurrentShoppingList();
}

loadRecipes().then(async () => {
  await loadSharedState();
  await loadImportFiles();
  if (!state.selectedRecipeId && state.recipes.length) state.selectedRecipeId = state.recipes[0].id;
  renderPlanningWeekSwitcher();
  renderSavedWeeksList();
  if (state.weekDrafts[state.selectedWeekStart]) {
    loadSelectedWeekDraft();
  } else {
    renderPlanningToggles();
    const restoredPlan = hydratePlan(state.savedPlan);
    if (restoredPlan) {
      state.plan = restoredPlan;
      if (isEmptyNoCookPlan(state.plan)) {
        startFreshWeek();
      } else {
        renderPlan(state.plan);
        renderCurrentShoppingList();
      }
    } else {
      if (state.lockedDays.size) {
        state.lockedDays.clear();
        localStorage.setItem(storageKeys.lockedDays, JSON.stringify([]));
      }
      generate({ carryPreviousMonday: true });
    }
  }
  renderActiveView();
});

function isEmptyNoCookPlan(plan) {
  return Boolean(plan?.days?.length) && plan.days.every((day) =>
    day.noCook
    && !day.lunch
    && !day.dinner
    && !day.snackDessert
    && !day.customLunch
    && !day.customDinner
    && !day.customSnackDessert,
  );
}

async function loadRecipes() {
  try {
    const response = await fetch("data/recipes.json", { cache: "no-store" });
    if (!response.ok) return;

    const importedRecipes = await response.json();
    if (Array.isArray(importedRecipes) && importedRecipes.length > 0) {
      state.recipes = importedRecipes;
    }
  } catch {
    state.recipes = sampleRecipes;
  }
}

async function loadImportFiles() {
  try {
    const response = await fetch(`${apiBase}/imports`, { cache: "no-store" });
    if (!response.ok) return;

    const payload = await response.json();
    state.importFiles = Array.isArray(payload.files) ? payload.files : [];
    const availableNames = new Set(state.importFiles.map((file) => file.name));
    state.selectedImportFiles = new Set([...state.selectedImportFiles].filter((name) => availableNames.has(name)));
  } catch {
    state.importFiles = [];
    state.selectedImportFiles.clear();
  }
}

async function updateRecipesFromImports() {
  if (state.importBusy) return;

  state.importBusy = true;
  state.importStatus = "Updating from imports folder...";
  renderImportPanel();

  try {
    const response = await fetch(`${apiBase}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: [...state.selectedImportFiles] }),
    });
    const responseText = await response.text();
    let payload = {};
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      payload = { message: responseText };
    }
    if (!response.ok) throw new Error(payload.message ?? response.statusText ?? "Import failed.");

    state.importStatus = [
      `${payload.recipeCount} active recipes`,
      `${payload.addedCount} added`,
      `${payload.updatedCount} updated`,
      `${payload.unchangedCount} unchanged`,
      `${payload.missingCount} removed from current import`,
    ].join(" · ");

    await loadRecipes();
    await loadImportFiles();
    if (!state.recipes.some((recipe) => recipe.id === state.selectedRecipeId)) {
      state.selectedRecipeId = state.recipes[0]?.id ?? null;
    }
    generate({ keepShoppingEdits: true, preserveDays: new Set(state.lockedDays) });
    renderActiveView();
  } catch (error) {
    state.importStatus = error instanceof Error ? error.message : "Import failed.";
    renderImportPanel();
  } finally {
    state.importBusy = false;
    renderImportPanel();
  }
}
