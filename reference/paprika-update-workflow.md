# Paprika Update Workflow

Use this when you have new recipes or edited recipes in Paprika and want the menu planner to reflect them.

## Recommended normal workflow

1. In Paprika, keep the recipes you want available in the planner in your Favorites collection.
2. When you add, remove, or edit recipes in Paprika, export the full Favorites collection again as a `.paprikarecipes` file.
3. Put the exported file in:

```text
/Users/shih-han/Documents/Codex/menu-generator/imports
```

4. Open the app at:

```text
http://127.0.0.1:5178/
```

5. Go to the Import tab.
6. Select the newest Favorites export.
7. Click Update recipes.

## What the update does

- New recipes in the selected export are added to the app.
- Recipes edited in Paprika are refreshed in the app.
- Recipes missing from the selected export are removed from the active app library.
- The app backs up `data/recipes.json` and `data/app-state.json` before updating.
- The app preserves your app-only recipe memory.

## What gets updated from Paprika

These fields come from the selected Paprika export:

- Paprika recipe title
- Ingredients
- Directions
- Notes
- Source link
- Categories
- Servings
- Prep, cook, and total time
- Rating

## What stays app-only

These fields are stored by the menu planner and are preserved across Paprika imports:

- Display name
- Hidden from planner
- Reviewed status
- Repeat preference
- Meal role
- Add-on type
- Planning tags
- Comment
- Current locked weekly plan and custom entries

## Full export vs small batch export

The selected import files define the active recipe library.

Best default: export the full Favorites collection from Paprika and select only that file.

Use a small batch export only when you intentionally want to add those recipes to the active library together with the selected Favorites export. For example, selecting both `Favorites` and `Pasta monday recipes` means the active library becomes Favorites plus Pasta Monday recipes.

## If you edit a recipe in Paprika

Re-export the Favorites collection after editing. When you import the new export, the planner updates the Paprika-owned recipe details while keeping your app-only display name, tags, roles, comments, and repeat settings.

## If you remove a recipe from Favorites

On the next Favorites import, that recipe disappears from the active app library. Its app-state memory is not manually deleted, so if you later import the same recipe again, its app-only settings can still be recovered.

## If the import panel gets crowded

Keep the newest Favorites export checked. You can leave old files in the folder, but it will be clearer over time to archive or remove old exports after a successful update.
