const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Next Monday"];
const preWeekShop = "Pre-week shop";

function normalizeShoppingDays(shoppingDays) {
  return shoppingDays
    .filter((day) => dayOrder.includes(day))
    .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
}

function normalizeItemKey(ingredient) {
  return ingredient.toLowerCase().replace(/\s+/g, " ").trim();
}

function findShoppingDayForMeal(mealIndex, shoppingDays) {
  const candidates = shoppingDays.filter((day) => dayOrder.indexOf(day) <= mealIndex);

  if (candidates.length > 0) return candidates[candidates.length - 1];
  return preWeekShop;
}

function getAllowedShoppingDays(earliestMealIndex, shoppingDays) {
  return [preWeekShop, ...shoppingDays].filter((day) => {
    if (day === preWeekShop) return true;
    return dayOrder.indexOf(day) <= earliestMealIndex;
  });
}

function addMealIngredients(items, meal, mealDay, mealType) {
  if (!meal) return;

  const shoppingItems = meal.shoppingItems?.length
    ? meal.shoppingItems.map((item) => item.name)
    : meal.ingredients;

  shoppingItems.forEach((ingredient) => {
    const id = normalizeItemKey(ingredient);
    const existing = items.get(id) ?? {
      id,
      name: ingredient,
      sources: [],
      earliestMealIndex: dayOrder.indexOf(mealDay),
    };

    existing.earliestMealIndex = Math.min(existing.earliestMealIndex, dayOrder.indexOf(mealDay));
    existing.sources.push({
      recipeTitle: meal.title,
      mealDay,
      mealType,
    });
    items.set(id, existing);
  });
}

export function splitShoppingList({ plan, shoppingDays, itemAssignments = new Map(), removedItemIds = new Set() }) {
  const normalizedDays = normalizeShoppingDays(shoppingDays);
  const items = new Map();
  const groups = new Map();

  plan.days.forEach((day) => {
    if (day.noCook) return;

    addMealIngredients(items, day.lunch, day.label, "Lunch");
    addMealIngredients(items, day.dinner, day.label, "Dinner");
    addMealIngredients(items, day.side, day.label, "Side");
  });

  items.forEach((item) => {
    if (removedItemIds.has(item.id)) return;

    const allowedShoppingDays = getAllowedShoppingDays(item.earliestMealIndex, normalizedDays);
    const requestedShopDay = itemAssignments.get(item.id);
    const shopDay = allowedShoppingDays.includes(requestedShopDay)
      ? requestedShopDay
      : findShoppingDayForMeal(item.earliestMealIndex, normalizedDays);

    const existing = groups.get(shopDay) ?? {
      day: shopDay,
      coveredDays: new Set(),
      items: [],
    };

    item.sources.forEach((source) => existing.coveredDays.add(source.mealDay));
    existing.items.push({
      ...item,
      assignedDay: shopDay,
      allowedShoppingDays,
    });
    groups.set(shopDay, existing);
  });

  return [...groups.values()]
    .sort((a, b) => {
      if (a.day === preWeekShop) return -1;
      if (b.day === preWeekShop) return 1;
      return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    })
    .map((group) => ({
      day: group.day,
      mealsCovered: [...group.coveredDays].join(", "),
      items: group.items.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
