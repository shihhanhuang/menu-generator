const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Next Monday"];
const preWeekShop = "Pre-week shop";

function isPantryStaple(ingredient) {
  const text = ingredient.toLowerCase();
  const staples = [
    "water",
    "boiling water",
    "warm water",
    "cold water",
    "salt",
    "kosher salt",
    "sea salt",
    "fine salt",
    "pepper",
    "black pepper",
    "white pepper",
    "ground pepper",
    "sugar",
    "white sugar",
    "brown sugar",
    "caster sugar",
    "granulated sugar",
    "olive oil",
    "extra virgin olive oil",
    "vegetable oil",
    "canola oil",
    "neutral oil",
    "cooking oil",
    "soy sauce",
    "light soy sauce",
    "dark soy sauce",
    "low sodium soy sauce",
    "sesame oil",
    "toasted sesame oil",
    "red wine vinegar",
    "butter",
    "unsalted butter",
    "salted butter",
  ];

  return staples.some((staple) => new RegExp(`\\b${staple.replaceAll(" ", "\\s+")}\\b`).test(text));
}

function isShoppingSectionHeader(ingredient) {
  const text = ingredient.toLowerCase().replace(/[:：]+$/, "").trim();
  if (!text) return true;
  if (/\d/.test(text)) return false;

  const exactHeaders = new Set([
    "filling",
    "füllung",
    "fuellung",
    "sauce",
    "marinade",
    "batter",
    "dough",
    "pastry base",
    "glaze",
    "topping",
    "toppings",
    "garnish",
    "seasonings",
    "for serving",
    "to serve",
  ]);

  if (exactHeaders.has(text)) return true;
  return /^(for|to)\s+/.test(text) || /^garnish\s+with\b/.test(text);
}

function titleCaseShoppingItem(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function cleanShoppingItemText(ingredient) {
  return ingredient
    .replace(/^[•*-]\s*/, "")
    .replace(/^(\d+(?:[.,]\d+)?)(g|kg|ml|l|dl|oz|lb|lbs)\b/i, "$1 $2")
    .replace(/^(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|dl|oz|lb|lbs))\/[^\s]+\s+/i, "$1 ")
    .replace(/\([^)]*(?:\d+\s*(?:-|–|to)?\s*)?(?:oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|kilogram|kilograms)\b[^)]*\)/gi, "")
    .replace(/\([^)]*(?:optional|if you wish|to taste|see note|note\s*\d*|for six servings|shh|to get|or|about\s+\d+)[^)]*\)/gi, "")
    .replace(/\([^A-Za-z0-9¼½¾⅓⅔⅛⅜⅝⅞]*\)/g, "")
    .replace(/\s*\([^)]*$/g, "")
    .replace(/,\s*(?:cleaned|trimmed|torn|cut|chopped|chop|sliced|slice|diced|dice|minced|mince|grated|shredded|peeled|rinsed|drained|divided|separated|seeded|finely|thinly|roughly|coarsely|halved|pitted|beaten|softened|melted|pressed|juiced|zested)\b.*$/i, "")
    .replace(/\b(?:finely|thinly|roughly|coarsely)?\s*(?:cleaned|trimmed|torn|cut|chopped|sliced|diced|minced|grated|shredded|peeled|rinsed|drained|seeded|halved|pitted|beaten|softened|melted|pressed|juiced|zested)\b\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[ ,;:-]+$/, "");
}

function finalizeShoppingItemDisplay(value) {
  return value
    .replace(/\([^A-Za-z0-9¼½¾⅓⅔⅛⅜⅝⅞]*\)/g, "")
    .replace(/\s*\([^)]*$/g, "")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[ ,;:-]+$/, "");
}

function parseCombinableShoppingItem(displayName) {
  const match = displayName.match(/^(.+),\s*([\d\s/.,¼½¾⅓⅔⅛⅜⅝⅞]+)(?:\s+([A-Za-z]+))?$/);
  if (!match) return null;

  const [, itemName, rawQuantity, unit = ""] = match;
  const quantity = parseShoppingQuantity(rawQuantity);
  if (!Number.isFinite(quantity)) return null;
  const normalizedAmount = normalizeShoppingAmount(quantity, normalizeShoppingUnit(unit));

  return {
    itemName: itemName.trim(),
    quantity: normalizedAmount.quantity,
    unit: normalizedAmount.unit,
    label: normalizedAmount.label === null
      ? ""
      : `${rawQuantity.trim()}${unit.trim() ? ` ${unit.trim()}` : ""}`,
  };
}

function parseShoppingQuantity(value) {
  const unicodeFractions = {
    "¼": 0.25,
    "½": 0.5,
    "¾": 0.75,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
    "⅛": 0.125,
    "⅜": 0.375,
    "⅝": 0.625,
    "⅞": 0.875,
  };
  const text = value.trim();
  const unicodeMatch = text.match(/^(\d+)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (unicodeMatch) {
    return Number(unicodeMatch[1] ?? 0) + unicodeFractions[unicodeMatch[2]];
  }

  const fractionMatch = text.match(/^(\d+\s+)?(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const whole = Number((fractionMatch[1] ?? "").trim() || 0);
    return whole + Number(fractionMatch[2]) / Number(fractionMatch[3]);
  }

  return Number(text.replace(",", "."));
}

function normalizeShoppingUnit(unit) {
  const normalized = unit.trim().toLowerCase();
  const aliases = {
    teaspoon: "tsp",
    teaspoons: "tsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    cups: "cup",
    grams: "g",
    gram: "g",
    kilograms: "kg",
    kilogram: "kg",
    litres: "l",
    litre: "l",
    liters: "l",
    liter: "l",
    ounces: "oz",
    ounce: "oz",
    pounds: "lb",
    pound: "lb",
    lbs: "lb",
    cans: "can",
    tins: "tin",
    jars: "jar",
    bags: "bag",
    boxes: "box",
    packets: "packet",
    packages: "package",
    bunches: "bunch",
    cloves: "clove",
    stalks: "stalk",
    slices: "slice",
    sheets: "sheet",
    pieces: "piece",
    fillets: "fillet",
  };

  return aliases[normalized] ?? normalized;
}

function normalizeShoppingAmount(quantity, unit) {
  const weightToGrams = {
    oz: 28.3495,
    lb: 453.592,
    kg: 1000,
  };

  if (weightToGrams[unit]) {
    return {
      quantity: quantity * weightToGrams[unit],
      unit: "g",
      label: null,
    };
  }

  return { quantity, unit };
}

function singularizeShoppingItemName(name) {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (/\b(?:leaves|chives|noodles|beans|greens|fries)\b$/.test(lower)) return lower;
  if (lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith("ges")) return lower.slice(0, -1);
  if (lower.endsWith("es") && !lower.endsWith("ses")) return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

function pluralizeShoppingItemName(name) {
  const trimmed = name.trim();
  if (/\b(?:shrimp|squid|fish)\b$/i.test(trimmed)) return trimmed;
  if (trimmed.endsWith("s")) return trimmed;
  if (trimmed.endsWith("y")) return `${trimmed.slice(0, -1)}ies`;
  if (/(?:tomato|potato|hero|echo|veto)$/i.test(trimmed)) return `${trimmed}es`;
  return `${trimmed}s`;
}

function formatCombinedShoppingItemName(parts) {
  const combinedAmounts = combineShoppingAmounts(parts.amounts);
  const countAmount = combinedAmounts.length === 1 && !combinedAmounts[0].unit ? combinedAmounts[0].quantity : null;
  const itemName = countAmount && countAmount > 1 ? pluralizeShoppingItemName(parts.itemName) : parts.itemName;
  const amountLabel = combinedAmounts.map(formatShoppingAmount).join(" + ");
  return `${itemName}, ${amountLabel}`;
}

function getShoppingItemIdentity(displayName) {
  const parts = parseCombinableShoppingItem(displayName);
  if (!parts) return {
    id: normalizeItemKey(singularizeShoppingItemName(displayName)),
    parts: null,
  };

  return {
    id: normalizeItemKey(singularizeShoppingItemName(parts.itemName)),
    parts: {
      itemName: parts.itemName,
      amounts: [{
        quantity: parts.quantity,
        unit: parts.unit,
        label: parts.label,
      }],
    },
  };
}

function combineShoppingAmounts(amounts) {
  const volumeUnits = new Set(["tsp", "tbsp"]);
  const groups = new Map();

  amounts.forEach((amount) => {
    const key = volumeUnits.has(amount.unit) ? "volume-small" : amount.unit;
    const values = groups.get(key) ?? [];
    values.push(amount);
    groups.set(key, values);
  });

  return [...groups.entries()].flatMap(([key, values]) => {
    if (key === "volume-small") {
      const totalTeaspoons = values.reduce((total, amount) => total + amount.quantity * (amount.unit === "tbsp" ? 3 : 1), 0);
      if (Number.isInteger(totalTeaspoons) && totalTeaspoons >= 3) {
        const tablespoons = Math.floor(totalTeaspoons / 3);
        const teaspoons = totalTeaspoons % 3;
        return [
          tablespoons ? { quantity: tablespoons, unit: "tbsp" } : null,
          teaspoons ? { quantity: teaspoons, unit: "tsp" } : null,
        ].filter(Boolean);
      }
      return [{ quantity: totalTeaspoons, unit: "tsp" }];
    }

    if (values.length === 1) return values;
    return [{
      quantity: values.reduce((total, amount) => total + amount.quantity, 0),
      unit: key,
    }];
  });
}

function formatShoppingAmount(amount) {
  if (amount.label) return amount.label;

  const displayQuantity = amount.unit === "g" ? Math.round(amount.quantity) : amount.quantity;
  const quantity = Number.isInteger(displayQuantity)
    ? String(displayQuantity)
    : String(Number(displayQuantity.toFixed(2))).replace(".", ",");
  return `${quantity}${amount.unit ? ` ${amount.unit}` : ""}`;
}

export function formatShoppingItemName(ingredient) {
  const cleaned = cleanShoppingItemText(ingredient);
  if (!cleaned) return "";

  const numericQuantity = String.raw`(?:\d+\s+)?\d+(?:[.,]\d+)?(?:\/\d+)?(?:\s*[¼½¾⅓⅔⅛⅜⅝⅞])?`;
  const wordQuantity = String.raw`one|two|three|four|five|six|seven|eight|nine|ten`;
  const fractionQuantity = String.raw`[¼½¾⅓⅔⅛⅜⅝⅞]`;
  const quantityPattern = String.raw`((?:about\s+)?(?:${numericQuantity}|${fractionQuantity}|${wordQuantity})(?:\s*(?:-|–|to)\s*(?:${numericQuantity}|${fractionQuantity}|${wordQuantity}))?(?:\s+${fractionQuantity})?)\s+(.+)`;
  const quantityMatch = cleaned.match(new RegExp(`^${quantityPattern}$`, "i"));
  if (!quantityMatch) return finalizeShoppingItemDisplay(titleCaseShoppingItem(cleaned));

  let [, quantity, rest] = quantityMatch;
  quantity = quantity.replace(/^About\b/, "about");
  const tokens = rest.split(" ");
  const unitWords = new Set([
    "tbsp",
    "tablespoon",
    "tablespoons",
    "tsp",
    "teaspoon",
    "teaspoons",
    "cup",
    "cups",
    "g",
    "dl",
    "gram",
    "grams",
    "kg",
    "ml",
    "l",
    "liter",
    "liters",
    "litre",
    "litres",
    "oz",
    "ounce",
    "ounces",
    "pound",
    "pounds",
    "lb",
    "lbs",
    "can",
    "cans",
    "tin",
    "tins",
    "jar",
    "jars",
    "bag",
    "bags",
    "box",
    "boxes",
    "packet",
    "packets",
    "package",
    "packages",
    "bunch",
    "bunches",
    "clove",
    "cloves",
    "stalk",
    "stalks",
    "slice",
    "slices",
    "sheet",
    "sheets",
    "piece",
    "pieces",
    "fillet",
    "fillets",
  ]);
  const sizeWords = new Set(["small", "medium", "large", "whole"]);

  let amount = quantity;
  let itemStart = 0;
  const firstToken = tokens[0]?.toLowerCase().replace(/[,.]/g, "");

  if (unitWords.has(firstToken)) {
    amount = `${amount} ${tokens[0]}`;
    itemStart = 1;
    if (tokens[itemStart]?.toLowerCase() === "of") itemStart += 1;
  } else if (sizeWords.has(firstToken)) {
    amount = `${amount} ${tokens[0]}`;
    itemStart = 1;
  }

  const item = tokens.slice(itemStart).join(" ").trim();
  if (!item) return finalizeShoppingItemDisplay(titleCaseShoppingItem(cleaned));
  return finalizeShoppingItemDisplay(`${titleCaseShoppingItem(item)}, ${amount}`);
}

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

function cloneCombinableParts(parts) {
  if (!parts) return null;
  return {
    itemName: parts.itemName,
    amounts: parts.amounts.map((amount) => ({ ...amount })),
  };
}

function combineItemParts(existing, parts) {
  if (!existing.combinableParts && parts) {
    existing.combinableParts = cloneCombinableParts(parts);
    existing.name = formatCombinedShoppingItemName(existing.combinableParts);
    return;
  }

  if (existing.combinableParts && parts) {
    existing.combinableParts.amounts.push(...parts.amounts.map((amount) => ({ ...amount })));
    existing.name = formatCombinedShoppingItemName(existing.combinableParts);
  }
}

function addMealIngredients(occurrences, meal, mealDay, mealType) {
  if (!meal) return;

  const shoppingItems = meal.shoppingItems?.length
    ? meal.shoppingItems
    : (meal.ingredients ?? []).map((ingredient) => ({ name: ingredient, raw: ingredient }));

  shoppingItems.forEach((shoppingItem) => {
    const ingredient = typeof shoppingItem === "string" ? shoppingItem : shoppingItem.name;
    if (!ingredient) return;
    if (isShoppingSectionHeader(ingredient)) return;
    if (isPantryStaple(ingredient)) return;

    const displayName = formatShoppingItemName(ingredient);
    if (!displayName) return;

    const { id, parts } = getShoppingItemIdentity(displayName);
    occurrences.push({
      id,
      name: parts ? formatCombinedShoppingItemName(parts) : displayName,
      combinableParts: cloneCombinableParts(parts),
      mealIndex: dayOrder.indexOf(mealDay),
      source: {
        recipeId: meal.id,
        paprikaUid: meal.paprikaUid,
        recipeTitle: meal.title,
        sourceUrl: meal.sourceUrl,
        mealDay,
        mealType,
      },
    });
  });
}

function parseManualShoppingItems(value) {
  return String(value ?? "")
    .split(/[\n;]+|,\s*(?=\d|[A-Za-z])/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name) => ({ name, raw: name }));
}

function getManualShoppingItems(manualShoppingItems, dayLabel, mealType) {
  return parseManualShoppingItems(manualShoppingItems[`${dayLabel}:${mealType}`]);
}

function getRecipeById(recipesById, recipeId) {
  if (!recipeId) return null;
  if (recipesById instanceof Map) return recipesById.get(recipeId) ?? null;
  return recipesById[recipeId] ?? null;
}

function getShoppingDaySortIndex(day) {
  return day === preWeekShop ? -1 : dayOrder.indexOf(day);
}

export function splitShoppingList({
  plan,
  shoppingDays,
  itemAssignments = new Map(),
  removedItemIds = new Set(),
  manualShoppingItems = {},
  dayDishes = {},
  recipesById = new Map(),
}) {
  const normalizedDays = normalizeShoppingDays(shoppingDays);
  const occurrences = [];
  const groupedItems = new Map();
  const groups = new Map();

  plan.days.forEach((day) => {
    if (day.noCook) return;

    addMealIngredients(occurrences, day.customLunch
      ? {
        id: `${day.label}:customLunch`,
        title: day.customLunch,
        shoppingItems: getManualShoppingItems(manualShoppingItems, day.label, "lunch"),
      }
      : day.lunch, day.label, "Lunch");
    addMealIngredients(occurrences, day.customDinner
      ? {
        id: `${day.label}:customDinner`,
        title: day.customDinner,
        shoppingItems: getManualShoppingItems(manualShoppingItems, day.label, "dinner"),
      }
      : day.dinner, day.label, "Dinner");
    addMealIngredients(occurrences, day.side, day.label, "Side");

    (dayDishes[day.label] ?? []).forEach((dish) => {
      const recipe = dish.source === "recipe" ? getRecipeById(recipesById, dish.recipeId) : null;
      const mealType = dish.mealType === "lunch" ? "Lunch" : "Dinner";
      const role = dish.role ? ` ${dish.role}` : "";

      addMealIngredients(occurrences, recipe ?? {
        id: dish.id,
        title: dish.title,
        shoppingItems: parseManualShoppingItems(dish.shoppingItems),
      }, day.label, `${mealType}${role}`);
    });
  });

  occurrences.forEach((occurrence) => {
    if (removedItemIds.has(occurrence.id)) return;

    const allowedShoppingDays = getAllowedShoppingDays(occurrence.mealIndex, normalizedDays);
    const requestedShopDay = itemAssignments.get(occurrence.id);
    const shopDay = allowedShoppingDays.includes(requestedShopDay)
      ? requestedShopDay
      : findShoppingDayForMeal(occurrence.mealIndex, normalizedDays);
    const itemKey = `${shopDay}:${occurrence.id}`;
    let item = groupedItems.get(itemKey);

    if (!item) {
      item = {
        id: occurrence.id,
        name: occurrence.name,
        combinableParts: cloneCombinableParts(occurrence.combinableParts),
        sources: [],
        earliestMealIndex: occurrence.mealIndex,
        assignedDay: shopDay,
        allowedShoppingDays,
      };
      groupedItems.set(itemKey, item);
    } else {
      combineItemParts(item, occurrence.combinableParts);
      item.earliestMealIndex = Math.min(item.earliestMealIndex, occurrence.mealIndex);
      item.allowedShoppingDays = getAllowedShoppingDays(item.earliestMealIndex, normalizedDays);
    }

    const existing = groups.get(shopDay) ?? {
      day: shopDay,
      coveredDays: new Set(),
      items: [],
    };

    existing.coveredDays.add(occurrence.source.mealDay);
    item.sources.push(occurrence.source);
    if (!existing.items.includes(item)) existing.items.push(item);
    groups.set(shopDay, existing);
  });

  const sortedGroups = [...groups.values()]
    .sort((a, b) => {
      if (a.day === preWeekShop) return -1;
      if (b.day === preWeekShop) return 1;
      return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    });
  const earlierItemsById = new Map();

  sortedGroups.forEach((group) => {
    group.items.forEach((item) => {
      const earlierItem = earlierItemsById.get(item.id);
      if (earlierItem && getShoppingDaySortIndex(earlierItem.day) < getShoppingDaySortIndex(item.assignedDay)) {
        item.combineEarlierDay = earlierItem.day;
      }
    });

    group.items.forEach((item) => {
      if (!earlierItemsById.has(item.id)) {
        earlierItemsById.set(item.id, { day: group.day });
      }
    });
  });

  return sortedGroups.map((group) => ({
    day: group.day,
    mealsCovered: [...group.coveredDays].join(", "),
    items: group.items,
  }));
}
