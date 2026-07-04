function scoreRecipe(recipe, context, usedRecipeIds) {
  let score = 0;
  const repeatFrequency = recipe.repeatFrequency ?? "occasional";
  const feedback = context.recipeFeedback?.[recipe.id] ?? {};
  const memoryTags = getEffectiveTags(recipe, context.recipeFeedback);
  const repeatPreference = feedback.repeatPreference ?? recipe.defaultRepeatPreference;
  const varietyKey = getRecipeVarietyKey(recipe);
  const daysSinceCooked = getDaysSinceCooked(recipe.id, context.cookingHistory);
  const inspiration = context.inspiration ?? "none";
  const useSeason = inspiration === "seasonal" || inspiration === "seasonalWeather";
  const useWeather = inspiration === "weather" || inspiration === "seasonalWeather";
  const season = context.season ?? getCurrentSeason();
  const seasonalWeather = getSeasonalWeather(season);

  if (useSeason) {
    if (memoryTags.has(season)) score += 4;
    if (hasSeasonalCue(recipe, season)) score += 3;
  }
  if (useWeather) {
    if (recipe.weatherFit.includes(seasonalWeather)) score += 2;
    if (recipe.weatherFit.includes("mixed")) score += 1;
    if (memoryTags.has("hotDay") && seasonalWeather === "hot") score += 3;
  }
  if (context.busy && recipe.effort === "low") score += 5;
  if (context.busy && recipe.effort === "high") score -= 6;
  if (!context.busy && recipe.effort === "medium") score += 2;
  if (context.isWeekend && recipe.effort !== "low") score += 2;
  if (repeatFrequency === "regular") score += 0.5;
  if (repeatFrequency === "rare") score -= 3;
  if (repeatPreference === "often") score += 2;
  if (repeatPreference === "less") score -= 8;
  if (repeatPreference === "rare") score -= 5;
  if (repeatPreference === "avoid") score -= 100;
  if (memoryTags.has("busyDay") && context.busy) score += 5;
  if (memoryTags.has("weekend") && context.isWeekend) score += 4;
  if (memoryTags.has("entertaining") && context.isWeekend) score += 3;
  if (feedback.hotDay && useWeather && seasonalWeather === "hot") score += 3;
  if (feedback.tooLong && context.busy) score -= 8;
  if (feedback.tooLong) score -= 2;
  if (memoryTags.has("handsOn") && context.busy) score -= 8;
  if (memoryTags.has("handsOn")) score -= 2;
  if (memoryTags.has("startEarly") && context.busy) score -= 4;
  if (memoryTags.has("startEarly") && context.isWeekend) score += 1;
  if (memoryTags.has("easy") && context.busy) score += 4;
  if (memoryTags.has("keeps")) score += 1;
  if (context.weekMood === "easy") {
    if (recipe.effort === "low") score += 5;
    if (memoryTags.has("easy")) score += 6;
    if (memoryTags.has("handsOn")) score -= 8;
    if (memoryTags.has("startEarly")) score -= 4;
    if (repeatPreference === "often") score += 2;
  }
  if (context.weekMood === "creative") {
    if (memoryTags.has("creative")) score += 7;
    if (repeatPreference === "often") score -= 2;
    if (usedRecipeIds.has(recipe.id)) score -= 4;
  }
  if (context.weekMood === "favorites") {
    if (repeatPreference === "often") score += 8;
    if (memoryTags.has("keeps")) score += 2;
  }
  if (context.weekMood === "asian") {
    if (memoryTags.has("asian")) score += 10;
    if (memoryTags.has("western")) score -= 5;
    if (memoryTags.has("flexibleCuisine")) score += 2;
  }
  if (context.weekMood === "western") {
    if (memoryTags.has("western")) score += 10;
    if (memoryTags.has("asian")) score -= 5;
    if (memoryTags.has("flexibleCuisine")) score += 2;
  }
  if (context.weekMood === "light") {
    if (memoryTags.has("light") || memoryTags.has("hotDay")) score += 6;
    if (recipe.weatherFit.includes("hot")) score += 3;
    if (recipe.effort === "high") score -= 3;
  }
  if (context.weekMood === "healthy") {
    if (memoryTags.has("healthy")) score += 8;
    if (memoryTags.has("light")) score += 4;
    if (recipe.weatherFit.includes("hot")) score += 2;
    if (memoryTags.has("cozy")) score -= 1;
  }
  if (context.weekMood === "minimal") {
    if (recipe.effort === "low") score += 8;
    if (memoryTags.has("easy")) score += 5;
    if (memoryTags.has("keeps")) score += 4;
    if (memoryTags.has("handsOn")) score -= 10;
    if (memoryTags.has("startEarly")) score -= 6;
    if (recipe.effort === "high") score -= 10;
  }
  if (context.weekMood === "cozy") {
    if (memoryTags.has("cozy")) score += 7;
    if (recipe.weatherFit.includes("cool") || recipe.weatherFit.includes("rainy")) score += 3;
  }
  if (daysSinceCooked !== null) {
    if (daysSinceCooked <= 7) score -= 16;
    else if (daysSinceCooked <= 14) score -= 10;
    else if (daysSinceCooked <= 28) score -= 5;
  }
  if (usedRecipeIds.has(recipe.id)) score -= repeatFrequency === "regular" ? 7 : 20;
  if (varietyKey && context.usedVarietyKeys?.has(varietyKey)) score -= 14;
  score += Math.random() * (context.randomness ?? 0);

  return score;
}

function getRecipeVarietyKey(recipe) {
  const text = [
    recipe.title,
    ...(recipe.categories ?? []),
    ...(recipe.ingredients ?? []),
    ...(recipe.pairingTags ?? []),
  ].join(" ").toLowerCase();
  const varietyTerms = [
    ["salmon", ["salmon"]],
    ["chicken", ["chicken", "turkey"]],
    ["beef", ["beef", "steak"]],
    ["pork", ["pork", "ham", "bacon", "sausage"]],
    ["shrimp", ["shrimp", "prawn"]],
    ["tuna", ["tuna"]],
    ["white-fish", ["cod", "haddock", "seelachs", "pollock"]],
    ["fish", ["fish"]],
    ["duck", ["duck"]],
    ["scallop", ["scallop"]],
    ["tofu", ["tofu"]],
    ["egg", ["egg", "eggs", "omelette", "tortilla"]],
    ["dumpling", ["dumpling", "dumplings", "wonton", "wontons"]],
    ["pasta", ["pasta", "spaghetti", "farfalle", "gnocchi", "spaghettini"]],
    ["noodles", ["noodle", "noodles", "ramen"]],
    ["rice", ["rice", "risotto", "don", "fan"]],
  ];

  return varietyTerms.find(([, terms]) => terms.some((term) => text.includes(term)))?.[0] ?? "";
}

function addVarietyKey(recipe, usedVarietyKeys) {
  const varietyKey = getRecipeVarietyKey(recipe);
  if (varietyKey) usedVarietyKeys.add(varietyKey);
}

function getUsedVarietyKeys(recipes, usedRecipeIds) {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const usedVarietyKeys = new Set();

  usedRecipeIds.forEach((recipeId) => {
    const recipe = recipesById.get(recipeId);
    if (recipe) addVarietyKey(recipe, usedVarietyKeys);
  });

  return usedVarietyKeys;
}

function getDaysSinceCooked(recipeId, cookingHistory = {}) {
  if (!recipeId) return null;

  const today = new Date();
  let mostRecentCooked = null;

  Object.values(cookingHistory).forEach((record) => {
    if (record?.recipeId !== recipeId || record.status !== "cooked" || !record.plannedFor) return;
    const cookedDate = new Date(`${record.plannedFor}T00:00:00`);
    if (Number.isNaN(cookedDate.getTime())) return;
    if (!mostRecentCooked || cookedDate > mostRecentCooked) mostRecentCooked = cookedDate;
  });

  if (!mostRecentCooked) return null;
  return Math.max(0, Math.floor((today - mostRecentCooked) / 86400000));
}

function getCurrentSeason(date = new Date()) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

function getSeasonalWeather(season) {
  if (season === "summer") return "hot";
  if (season === "winter") return "cool";
  if (season === "autumn") return "rainy";
  return "mixed";
}

function hasSeasonalCue(recipe, season) {
  const text = `${recipe.title} ${(recipe.ingredients ?? []).join(" ")}`.toLowerCase();
  const cues = {
    spring: ["asparagus", "rhubarb", "pea", "peas", "spring", "radish", "mint", "new potato"],
    summer: ["summer", "tomato", "corn", "zucchini", "aubergine", "eggplant", "cucumber", "berry", "peach"],
    autumn: ["autumn", "fall", "mushroom", "squash", "pumpkin", "apple", "pear", "chestnut"],
    winter: ["winter", "stew", "soup", "braise", "roast", "cabbage", "leek", "root vegetable"],
  };

  return (cues[season] ?? []).some((cue) => text.includes(cue));
}

function isSnackDessertRecipe(recipe, recipeFeedback = {}) {
  const feedback = recipeFeedback[recipe.id] ?? {};
  const memoryTags = getEffectiveTags(recipe, recipeFeedback);
  if (hasRoleOverride(recipe, recipeFeedback)) return isRecipeRoleEnabled(recipe, "snackDessert", recipeFeedback);
  if (isRecipeRoleEnabled(recipe, "snackDessert", recipeFeedback)) return true;
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

function getEffectiveRoles(recipe, recipeFeedback = {}) {
  const feedback = recipeFeedback[recipe.id] ?? {};
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

function hasRoleOverride(recipe, recipeFeedback = {}) {
  return Array.isArray(recipeFeedback[recipe.id]?.roles);
}

function isRecipeRoleEnabled(recipe, role, recipeFeedback = {}) {
  return getEffectiveRoles(recipe, recipeFeedback).includes(role);
}

function isMainRecipe(recipe, recipeFeedback = {}) {
  return isRecipeRoleEnabled(recipe, "main", recipeFeedback);
}

function isAddOnRecipe(recipe, recipeFeedback = {}) {
  return isRecipeRoleEnabled(recipe, "addOn", recipeFeedback);
}

function getAddOnRoles(recipe, recipeFeedback = {}) {
  const feedback = recipeFeedback[recipe.id] ?? {};
  if (Array.isArray(feedback.addOnRoles)) return feedback.addOnRoles;
  if (feedback.addOnRole) return [feedback.addOnRole];
  if (Array.isArray(recipe.defaultAddOnRoles)) return recipe.defaultAddOnRoles;
  if (recipe.defaultAddOnRole) return [recipe.defaultAddOnRole];
  return ["side"];
}

function getEffectiveTags(recipe, recipeFeedback = {}) {
  const feedback = recipeFeedback[recipe.id] ?? {};
  const suppressedTags = new Set(feedback.suppressedTags ?? []);
  const tags = new Set([...(recipe.defaultTags ?? []), ...(feedback.tags ?? [])]);

  if (tags.has("canMakeAhead")) tags.add("keeps");
  if (tags.has("needsTime")) tags.add("handsOn");
  suppressedTags.forEach((tag) => tags.delete(tag));
  return tags;
}

function getRepeatPreference(recipe, recipeFeedback = {}) {
  return recipeFeedback[recipe.id]?.repeatPreference ?? recipe.defaultRepeatPreference;
}

function isRecipeHidden(recipe, recipeFeedback = {}) {
  return recipeFeedback[recipe.id]?.hiddenFromPlanner === true;
}

function chooseRecipe(recipes, context, usedRecipeIds, excludedRecipeIds, filter = () => true) {
  const options = chooseRecipeOptions(recipes, context, usedRecipeIds, excludedRecipeIds, filter, context.randomness ? 6 : 1);
  if (!options.length) return null;
  if (!context.randomness || options.length === 1) return options[0];

  const pickFrom = options.slice(0, Math.min(6, options.length));
  return pickFrom[Math.floor(Math.random() * pickFrom.length)];
}

function chooseRecipeOptions(recipes, context, usedRecipeIds, excludedRecipeIds, filter = () => true, limit = 3) {
  const candidates = recipes
    .filter(filter)
    .filter((recipe) => !isRecipeHidden(recipe, context.recipeFeedback))
    .filter((recipe) => getRepeatPreference(recipe, context.recipeFeedback) !== "avoid")
    .filter((recipe) => !excludedRecipeIds.has(recipe.id))
    .map((recipe) => ({
      recipe,
      score: scoreRecipe(recipe, context, usedRecipeIds),
    }))
    .sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title));

  const selected = [];
  const selectedVarietyKeys = new Set();

  candidates.forEach((candidate) => {
    if (selected.length >= limit) return;
    const varietyKey = getRecipeVarietyKey(candidate.recipe);
    if (varietyKey && selectedVarietyKeys.has(varietyKey)) return;
    selected.push(candidate.recipe);
    if (varietyKey) selectedVarietyKeys.add(varietyKey);
  });

  candidates.forEach((candidate) => {
    if (selected.length >= limit) return;
    if (selected.some((recipe) => recipe.id === candidate.recipe.id)) return;
    selected.push(candidate.recipe);
  });

  return selected;
}

export function buildMealOptions({
  recipes,
  label,
  mealType,
  inspiration = "none",
  busy = false,
  recipeFeedback = {},
  cookingHistory = {},
  weekMood = "balanced",
  excludedRecipeIds = new Set(),
  usedRecipeIds = new Set(),
  randomness = 0,
  limit = 3,
}) {
  const context = {
    label,
    inspiration,
    season: getCurrentSeason(),
    busy: mealType === "lunch" ? true : mealType === "snackDessert" ? false : busy,
    isWeekend: label === "Saturday" || label === "Sunday",
    recipeFeedback,
    cookingHistory,
    weekMood,
    randomness,
    usedVarietyKeys: getUsedVarietyKeys(recipes, usedRecipeIds),
  };
  const filter = mealType === "snackDessert"
    ? (recipe) => isSnackDessertRecipe(recipe, recipeFeedback)
    : (recipe) => isMainRecipe(recipe, recipeFeedback) && !isSnackDessertRecipe(recipe, recipeFeedback);

  return chooseRecipeOptions(recipes, context, usedRecipeIds, excludedRecipeIds, filter, limit);
}

function scoreSideRecipe(sideRecipe, mainRecipe, context, usedRecipeIds) {
  let score = scoreRecipe(sideRecipe, context, usedRecipeIds);
  const mainTags = new Set(mainRecipe.pairingTags ?? []);
  const sideTags = sideRecipe.pairingTags ?? [];
  const overlap = sideTags.filter((tag) => mainTags.has(tag)).length;
  const addOnRoles = new Set(getAddOnRoles(sideRecipe, context.recipeFeedback));

  score += overlap * 3;
  if (addOnRoles.has("side")) score += 6;
  if (sideTags.includes("fresh") && mainTags.has("creamy")) score += 3;
  if (sideTags.includes("vegetable")) score += 2;
  if (sideRecipe.effort === "low") score += 2;
  if (sideRecipe.id === mainRecipe.id) score -= 100;

  return score;
}

function chooseSideRecipe(recipes, mainRecipe, context, usedRecipeIds, excludedRecipeIds) {
  const candidates = recipes
    .filter((recipe) => isAddOnRecipe(recipe, context.recipeFeedback))
    .filter((recipe) => recipe.id !== mainRecipe.id)
    .filter((recipe) => getRecipeDisplayTitle(recipe).toLowerCase() !== getRecipeDisplayTitle(mainRecipe).toLowerCase())
    .filter((recipe) => getAddOnRoles(recipe, context.recipeFeedback).some((role) =>
      ["side", "salad", "vegetable", "carb"].includes(role),
    ))
    .filter((recipe) => !isRecipeHidden(recipe, context.recipeFeedback))
    .filter((recipe) => getRepeatPreference(recipe, context.recipeFeedback) !== "avoid")
    .filter((recipe) => !excludedRecipeIds.has(recipe.id))
    .map((recipe) => ({
      recipe,
      score: scoreSideRecipe(recipe, mainRecipe, context, usedRecipeIds),
    }))
    .sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title));

  return candidates[0]?.recipe ?? null;
}

export function buildPlan({
  recipes,
  days,
  inspiration = "none",
  busyDays,
  lunchDays,
  snackDessertDays = new Set(),
  noCookDays = new Set(),
  excludedRecipeIdsBySlot = new Map(),
  recipeFeedback = {},
  cookingHistory = {},
  weekMood = "balanced",
  randomness = 0,
}) {
  const usedRecipeIds = new Set();
  const usedVarietyKeys = new Set();

  const plannedDays = days.map((label) => {
    const noDinner = noCookDays.has(label);

    const context = {
      label,
      inspiration,
      season: getCurrentSeason(),
      busy: busyDays.has(label),
      isWeekend: label === "Saturday" || label === "Sunday",
      recipeFeedback,
      cookingHistory,
      weekMood,
      randomness,
      usedVarietyKeys,
    };

    const dinner = noDinner
      ? null
      : chooseRecipe(
          recipes,
          context,
          usedRecipeIds,
          excludedRecipeIdsBySlot.get(`${label}:dinner`) ?? new Set(),
          (recipe) => isMainRecipe(recipe, recipeFeedback) && !isSnackDessertRecipe(recipe, recipeFeedback),
        ) ?? chooseRecipe(recipes, context, usedRecipeIds, new Set(), (recipe) =>
          isMainRecipe(recipe, recipeFeedback) && !isSnackDessertRecipe(recipe, recipeFeedback),
        );
    const dinnerOptions = noDinner
      ? []
      : chooseRecipeOptions(
          recipes,
          context,
          usedRecipeIds,
          excludedRecipeIdsBySlot.get(`${label}:dinner`) ?? new Set(),
          (recipe) => isMainRecipe(recipe, recipeFeedback) && !isSnackDessertRecipe(recipe, recipeFeedback),
          3,
        );
    if (dinner && !dinnerOptions.some((recipe) => recipe.id === dinner.id)) dinnerOptions.unshift(dinner);

    if (!dinner && !noDinner) {
      throw new Error("No dinner recipes are available for planning.");
    }

    if (dinner) {
      usedRecipeIds.add(dinner.id);
      addVarietyKey(dinner, usedVarietyKeys);
    }

    const side = dinner?.recipeRole === "main"
      ? chooseSideRecipe(
          recipes,
          dinner,
          context,
          usedRecipeIds,
          excludedRecipeIdsBySlot.get(`${label}:side`) ?? new Set(),
        ) ?? chooseSideRecipe(recipes, dinner, context, usedRecipeIds, new Set())
      : null;

    if (side) usedRecipeIds.add(side.id);
    if (side) addVarietyKey(side, usedVarietyKeys);

    const lunch = lunchDays.has(label)
      ? chooseRecipe(
          recipes,
          { ...context, busy: true },
          usedRecipeIds,
          excludedRecipeIdsBySlot.get(`${label}:lunch`) ?? new Set(),
          (recipe) => isMainRecipe(recipe, recipeFeedback) && !isSnackDessertRecipe(recipe, recipeFeedback),
        ) ?? chooseRecipe(recipes, { ...context, busy: true }, usedRecipeIds, new Set(), (recipe) =>
          isMainRecipe(recipe, recipeFeedback) && !isSnackDessertRecipe(recipe, recipeFeedback),
        )
      : null;
    const lunchOptions = lunchDays.has(label)
      ? chooseRecipeOptions(
          recipes,
          { ...context, busy: true },
          usedRecipeIds,
          excludedRecipeIdsBySlot.get(`${label}:lunch`) ?? new Set(),
          (recipe) => isMainRecipe(recipe, recipeFeedback) && !isSnackDessertRecipe(recipe, recipeFeedback),
          3,
        )
      : [];
    if (lunch && !lunchOptions.some((recipe) => recipe.id === lunch.id)) lunchOptions.unshift(lunch);

    if (lunch) usedRecipeIds.add(lunch.id);
    if (lunch) addVarietyKey(lunch, usedVarietyKeys);
    const snackDessert = snackDessertDays.has(label)
      ? chooseRecipe(
          recipes,
          { ...context, busy: false },
          usedRecipeIds,
          excludedRecipeIdsBySlot.get(`${label}:snackDessert`) ?? new Set(),
          (recipe) => isSnackDessertRecipe(recipe, recipeFeedback),
        ) ?? chooseRecipe(
          recipes,
          { ...context, busy: false },
          usedRecipeIds,
          new Set(),
          (recipe) => isSnackDessertRecipe(recipe, recipeFeedback),
        )
      : null;
    const snackDessertOptions = snackDessertDays.has(label)
      ? chooseRecipeOptions(
          recipes,
          { ...context, busy: false },
          usedRecipeIds,
          excludedRecipeIdsBySlot.get(`${label}:snackDessert`) ?? new Set(),
          (recipe) => isSnackDessertRecipe(recipe, recipeFeedback),
          3,
        )
      : [];
    if (snackDessert && !snackDessertOptions.some((recipe) => recipe.id === snackDessert.id)) snackDessertOptions.unshift(snackDessert);

    if (snackDessert) usedRecipeIds.add(snackDessert.id);
    if (snackDessert) addVarietyKey(snackDessert, usedVarietyKeys);

    return {
      label,
      busy: context.busy,
      noDinner,
      noCook: noDinner && !lunchDays.has(label) && !snackDessertDays.has(label),
      dinner,
      dinnerOptions: dinnerOptions.slice(0, 3),
      side,
      lunch,
      lunchOptions: lunchOptions.slice(0, 3),
      snackDessert,
      snackDessertOptions: snackDessertOptions.slice(0, 3),
      snackDessertNeeded: snackDessertDays.has(label),
      reason: dinner ? buildReason(dinner, context) : "No dinner planned",
    };
  });

  return { days: plannedDays };
}

function buildReason(recipe, context) {
  const parts = [];

  if (context.busy && recipe.effort === "low") parts.push("low-effort for a busy day");
  if ((context.inspiration === "seasonal" || context.inspiration === "seasonalWeather") && hasSeasonalCue(recipe, context.season)) {
    parts.push(`a ${context.season} nudge`);
  }
  if ((context.inspiration === "weather" || context.inspiration === "seasonalWeather") && recipe.weatherFit.includes(getSeasonalWeather(context.season))) {
    parts.push("fits the weather nudge");
  }
  if (context.isWeekend && recipe.effort === "high") parts.push("better suited to weekend cooking");
  if (recipe.leftovers === "good") parts.push("useful leftovers");
  if (recipe.repeatFrequency === "regular") parts.push("a reliable repeat meal");
  if (recipe.recipeRole === "main") parts.push("paired with a side");

  return parts.length > 0 ? parts.join(", ") : "balanced pick for the week";
}
