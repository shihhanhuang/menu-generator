# Shopping List Feature Plan

The shopping list should turn the generated menu into a practical shop-by-trip list. It should feel like a list you can take to the store, not a recipe ingredient dump.

## Goals

- Ask when shopping will happen for the planned week.
- Split groceries by shopping trip based on when meals will be eaten.
- Put each item as late as possible while still being available for the meal.
- Let the user move an item earlier if they want to buy it sooner.
- Do not allow moving an item later than its first needed meal.
- Exclude pantry staples such as salt, sugar, olive oil, oil, pepper, and water.
- Show shopping rows as item plus amount, without preparation instructions.
- Keep a route back to the Paprika recipe for context when needed.

## Current App Fit

The app already has a starting point:

- `src/planning/shoppingSplitter.js` groups recipe shopping items by shopping day.
- `scripts/import_paprika.py` creates `shoppingItems` from Paprika ingredients and removes some staples.
- `src/app.js` stores `shoppingDays`, `shoppingItemAssignments`, and removed shopping items in memory.
- Recipe data already includes `paprikaUid`, `source`, `sourceUrl`, `ingredients`, and `shoppingItems`.
- The recipe detail UI can open `sourceUrl` when Paprika recipes include an original source URL.

The next implementation should build on these pieces rather than introducing a separate shopping model.

## User Flow

1. User generates or loads a weekly menu.
2. Shopping panel asks: "When will you shop?"
3. User chooses one or more shopping days for the week.
4. The app generates grouped shopping lists for those trips.
5. User can remove items they already have.
6. User can move an item to an earlier trip.
7. User can expand an item to see which meals need it and open the related Paprika recipe/source.

Example:

```text
Shopping days:
- Monday
- Thursday

Meals:
- Monday dinner: Chicken curry
- Wednesday lunch: Tomato soup
- Friday dinner: Salmon with potatoes

Generated list:

Monday
- Chicken thighs, 1.2 kg
- Coconut milk, 1 can
- Tomatoes, 800 g

Thursday
- Salmon fillets, 4
- Potatoes, 1 kg
```

## Assignment Rules

Use the earliest meal date for an item as its deadline.

- If an item is needed for Monday and Thursday, the deadline is Monday.
- If the user shops Monday and Thursday, the item belongs on Monday.
- If an item is only needed Friday and the user shops Monday and Thursday, it belongs on Thursday.
- If no shopping day exists before the meal, assign it to `Pre-week shop`.

Allowed movement:

- Items can move to `Pre-week shop` or any shopping day before or on their earliest meal.
- Items cannot move to a shopping day after their earliest meal.

This matches the current `allowedShoppingDays` behavior in `shoppingSplitter.js`.

## Shopping Item Display

The list should display:

```text
Item, amount unit
```

Examples:

```text
- Chicken thighs, 1.2 kg
- Canned tomatoes, 800 g
- Lemons, 2
- Greek yogurt, 500 g
```

Avoid showing preparation language:

```text
minced
chopped
diced
sliced
peeled
trimmed
divided
room temperature
optional
to taste
for garnish
```

The importer already strips some of this in `clean_ingredient_line`, but a later version should normalize amount, unit, and item name separately so duplicate items can merge more reliably.

## Pantry Staples

Default excluded staples:

```text
salt
pepper
black pepper
white pepper
sugar
brown sugar
water
boiling water
warm water
cold water
olive oil
extra virgin olive oil
vegetable oil
canola oil
neutral oil
```

Keep this list conservative. Items such as flour, butter, soy sauce, vinegar, sesame oil, and stock should not be excluded by default because they vary by household.

Future enhancement: add a pantry staples setting backed by shared app state.

## Paprika Recipe References

Each shopping item should keep source recipe references, even though the shopping list row should stay short.

Display behavior:

- Main row: item and amount only.
- Secondary collapsed detail: meal/day and recipe title.
- Recipe action: open the app's recipe detail or source overlay.

Example:

```text
- Salmon fillets, 4
  Needed for: Friday dinner, Salmon with potatoes
  [View recipe]
```

Implementation notes:

- Extend `shoppingSplitter.js` item sources with `recipeId`, `paprikaUid`, and `sourceUrl` where available.
- Keep `recipeTitle` for display, using the app display title when possible.
- In `renderShopping`, render a compact "View recipe" action for each source recipe.
- Reuse the existing source overlay for `sourceUrl`.
- If no `sourceUrl` exists, switch to the Recipes tab and select the recipe in the local recipe detail panel.

## Data Model Direction

Current ingredients are strings. That is enough for the first version, but the feature will be stronger if imported shopping items eventually look like this:

```json
{
  "name": "Chicken thighs",
  "amount": "1.2",
  "unit": "kg",
  "raw": "1.2 kg chicken thighs, trimmed"
}
```

Then display can use:

```text
Chicken thighs, 1.2 kg
```

For now, do not block the feature on perfect parsing. Use cleaned Paprika lines and improve parsing iteratively.

## MVP Implementation Checklist

- Unhide the shopping panel and replace "Tabled for now" with shopping-day controls.
- Let users toggle shopping days directly in the shopping panel.
- Continue using `splitShoppingList` to group by trip.
- Expand staple filtering in `scripts/import_paprika.py`.
- Keep shopping rows compact.
- Add expandable source details under each item.
- Add `View recipe` behavior from shopping items.
- Persist shopping day choices and item moves if they should survive page reloads.

## Later Enhancements

- Merge duplicate items across recipes by normalized item name.
- Add configurable pantry staples.
- Add a "mark bought" checkbox per item.
- Add grocery aisle grouping.
- Add print/mobile-friendly shopping mode.
- Deduct known pantry inventory if a pantry module is added later.
