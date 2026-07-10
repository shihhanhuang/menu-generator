#!/usr/bin/env python3
"""Import Paprika .paprikarecipes archives into the app's local recipe JSON."""

from __future__ import annotations

import argparse
import gzip
import json
import re
import shutil
import zipfile
from datetime import date
from datetime import datetime
from pathlib import Path
from typing import Any


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "recipe"


def parse_minutes(value: str) -> int | None:
    if not value:
        return None

    total = 0
    text = value.lower()
    hours = re.search(r"(\d+(?:\.\d+)?)\s*(?:hour|hr|h)", text)
    minutes = re.search(r"(\d+)\s*(?:minute|min|m)", text)

    if hours:
        total += int(float(hours.group(1)) * 60)
    if minutes:
        total += int(minutes.group(1))
    if total:
        return total

    bare_number = re.search(r"\d+", text)
    return int(bare_number.group(0)) if bare_number else None


def infer_effort(recipe: dict[str, Any]) -> str:
    prep = parse_minutes(recipe.get("prep_time", ""))
    cook = parse_minutes(recipe.get("cook_time", ""))
    total = parse_minutes(recipe.get("total_time", ""))

    minutes = total or sum(value for value in [prep, cook] if value)
    directions = recipe.get("directions", "")
    step_count = len(re.findall(r"(^|\n)\s*\d+[\).]", directions))

    if minutes and minutes <= 30 and step_count <= 5:
        return "low"
    if minutes and minutes >= 75:
        return "high"
    if step_count >= 9:
        return "high"
    return "medium"


def infer_repeat_frequency(recipe: dict[str, Any]) -> str:
    rating = recipe.get("rating") or 0
    categories = [category.lower() for category in recipe.get("categories", [])]

    if rating >= 4:
        return "regular"
    if any("favorites" in category or "favourite" in category for category in categories):
        return "regular"
    if any("special" in category or "party" in category for category in categories):
        return "rare"
    return "occasional"


def infer_weather_fit(recipe: dict[str, Any]) -> list[str]:
    text = " ".join(
        [
            recipe.get("name", ""),
            recipe.get("ingredients", ""),
            recipe.get("categories", [""])[0] if recipe.get("categories") else "",
        ]
    ).lower()

    hot_terms = ["salad", "lemon", "lime", "zucchini", "corn", "tomato", "basil", "quesadilla"]
    cool_terms = ["stew", "soup", "braised", "bake", "auflauf", "risotto"]
    rainy_terms = ["stew", "soup", "risotto", "cream", "gnocchi", "bolognese"]

    fit = {"mixed"}
    if any(term in text for term in hot_terms):
        fit.add("hot")
    if any(term in text for term in cool_terms):
        fit.add("cool")
    if any(term in text for term in rainy_terms):
        fit.add("rainy")

    return sorted(fit)


def infer_leftovers(recipe: dict[str, Any]) -> str:
    text = " ".join([recipe.get("name", ""), recipe.get("ingredients", "")]).lower()

    if any(term in text for term in ["salad", "quesadilla", "sprouts"]):
        return "okay"
    if any(term in text for term in ["stew", "soup", "pasta", "gnocchi", "risotto", "bolognese"]):
        return "good"
    return "okay"


def infer_meal_types(recipe: dict[str, Any], leftovers: str) -> list[str]:
    text = " ".join([recipe.get("name", ""), " ".join(recipe.get("categories", []))]).lower()
    dessert_terms = [
        "dessert",
        "snack",
        "cake",
        "cookie",
        "cookies",
        "biscuit",
        "brownie",
        "muffin",
        "pudding",
        "ice cream",
        "chocolate",
        "tart",
        "pie",
        "candy",
        "truffle",
        "rum ball",
        "sweet treat",
    ]

    if "baking savory" not in text and "savory" not in text and any(term in text for term in dessert_terms):
        return ["dessert", "snack"]

    meal_types = ["dinner"]
    if leftovers == "good":
        meal_types.append("lunch")
    return meal_types


def infer_pairing_tags(recipe: dict[str, Any]) -> list[str]:
    text = " ".join(
        [
            recipe.get("name", ""),
            recipe.get("ingredients", ""),
        ]
    ).lower()
    tags: set[str] = set()

    tag_terms = {
        "pasta": ["pasta", "spaghetti", "fettuccine", "penne", "orzo", "gnocchi", "noodle"],
        "vegetable": ["carrot", "parsnip", "peas", "corn", "zucchini", "broccoli", "sprout", "salad"],
        "fresh": ["salad", "lemon", "lime", "basil", "cucumber", "tomato"],
        "creamy": ["cream", "cheese", "butter", "risotto"],
        "hearty": ["stew", "bacon", "sausage", "beef", "potato"],
        "seafood": ["salmon", "shrimp", "fish"],
    }

    for tag, terms in tag_terms.items():
        if any(term in text for term in terms):
            tags.add(tag)

    return sorted(tags or {"flexible"})


def infer_recipe_role(recipe: dict[str, Any]) -> str:
    text = recipe.get("name", "").lower()

    side_terms = [
        "salad",
        "carrot",
        "parsnip",
        "peas",
        "corn",
        "brussels sprouts",
        "sprouts",
    ]
    complete_terms = [
        "stew",
        "pasta",
        "spaghetti",
        "fettuccine",
        "penne",
        "gnocchi",
        "risotto",
        "quesadilla",
        "pizza",
        "noodle",
        "auflauf",
    ]

    if any(term in text for term in complete_terms):
        return "complete"
    if any(term in text for term in side_terms):
        return "side"
    return "main"


def recipe_text(recipe: dict[str, Any]) -> str:
    return " ".join(
        [
            recipe.get("name", ""),
            recipe.get("ingredients", ""),
            recipe.get("directions", ""),
            " ".join(recipe.get("categories", [])),
        ]
    ).lower()


def recipe_title_category_text(recipe: dict[str, Any]) -> str:
    return " ".join([recipe.get("name", ""), " ".join(recipe.get("categories", []))]).lower()


def infer_default_repeat_preference(recipe: dict[str, Any]) -> str:
    categories = [category.lower() for category in recipe.get("categories", [])]
    rating = recipe.get("rating") or 0

    if rating >= 4:
        return "often"
    if any(category in {"takes time", "special occasion", "for entertaining"} for category in categories):
        return "rare"
    return "normal"


def infer_default_roles(recipe: dict[str, Any], meal_types: list[str], recipe_role: str) -> list[str]:
    text = recipe_text(recipe)
    title_text = recipe_title_category_text(recipe)
    categories = {category.lower() for category in recipe.get("categories", [])}
    roles: set[str] = set()

    snack_dessert_terms = [
        "dessert",
        "baking sweet",
        "snack",
        "cake",
        "cookie",
        "cookies",
        "brownie",
        "muffin",
        "pudding",
        "ice cream",
        "truffle",
        "rum ball",
        "sweet treat",
    ]
    if any(meal_type in {"snack", "dessert", "snackDessert"} for meal_type in meal_types):
        roles.add("snackDessert")
    if any(term in text for term in snack_dessert_terms) and "baking savory" not in categories:
        roles.add("snackDessert")

    add_on_categories = {"sides", "side", "salad", "vegetables", "appetizer", "appetizers"}
    add_on_terms = [
        "salad",
        "slaw",
        "carrot",
        "parsnip",
        "asparagus",
        "green bean",
        "cabbage",
        "brussels sprout",
        "sprouts",
        "dip",
        "sauce",
        "pickled",
        "bundle",
    ]
    if recipe_role == "side" or categories & add_on_categories or any(term in title_text for term in add_on_terms):
        roles.add("addOn")

    main_categories = {"mains", "meat", "seafood", "soup", "pasta", "one pot", "asian", "chinese", "japanese"}
    main_terms = [
        "pasta",
        "spaghetti",
        "noodle",
        "rice bowl",
        "fried rice",
        "stew",
        "soup",
        "curry",
        "chicken",
        "beef",
        "pork",
        "ribs",
        "fish",
        "salmon",
        "shrimp",
        "tofu",
        "quesadilla",
        "pizza",
        "risotto",
        "gnocchi",
    ]
    if categories & main_categories or any(term in text for term in main_terms):
        roles.add("main")
    if "dinner" in meal_types or "lunch" in meal_types:
        roles.add("main")

    if roles == {"snackDessert"}:
        return ["snackDessert"]
    if not roles:
        roles.add("main")
    return sorted(roles)


def infer_add_on_roles(recipe: dict[str, Any], default_roles: list[str]) -> list[str]:
    if "addOn" not in default_roles:
        return []

    text = recipe_text(recipe)
    categories = {category.lower() for category in recipe.get("categories", [])}
    roles: set[str] = set()

    if "appetizer" in categories or "appetizers" in categories or "appetizer" in text:
        roles.add("appetizer")
    if "salad" in categories or "salad" in text or "slaw" in text:
        roles.add("salad")
    if re.search(r"\b(rice|noodle|pasta|potato|bread|toast|polenta|couscous)\b", text):
        roles.add("carb")
    if re.search(r"\b(chicken|beef|pork|tofu|egg|salmon|shrimp|fish|beans?)\b", text):
        roles.add("protein")
    if re.search(r"\b(carrot|parsnip|asparagus|zucchini|cabbage|broccoli|pea|corn|green bean|sprout|vegetable)\b", text):
        roles.add("vegetable")

    return sorted(roles or {"side"})


def infer_default_tags(recipe: dict[str, Any], effort: str, default_roles: list[str]) -> list[str]:
    text = recipe_text(recipe)
    categories = {category.lower() for category in recipe.get("categories", [])}
    tags: set[str] = set()

    if effort == "low" or categories & {"easy", "fast", "one pot"}:
        tags.update(["easy", "busyDay"])
    if effort == "high" or categories & {"takes time"}:
        tags.add("handsOn")
    if categories & {"make ahead", "freezes", "big batch"}:
        tags.add("keeps")
    if categories & {"healthy"}:
        tags.add("healthy")
    if categories & {"special occasion", "for entertaining", "family visits"}:
        tags.add("entertaining")
    if categories & {"to try", "fancy"}:
        tags.add("creative")

    asian_terms = [
        "asian",
        "chinese",
        "japanese",
        "korean",
        "thai",
        "vietnamese",
        "indian",
        "cantonese",
        "sichuan",
        "soy sauce",
        "sesame oil",
        "miso",
        "gochujang",
        "gochugaru",
        "rice vinegar",
        "fish sauce",
        "oyster sauce",
        "hoisin",
        "mirin",
        "sake",
        "dashi",
        "kimchi",
        "ginger",
        "scallion",
        "spring onion",
        "noodle",
        "rice bowl",
        "curry paste",
        "coconut milk",
    ]
    western_terms = [
        "western",
        "italian",
        "french",
        "british",
        "american",
        "mediterranean",
        "pasta",
        "risotto",
        "gratin",
        "roast",
        "stew",
        "pie",
        "cream",
        "cheese",
        "butter",
        "potato",
        "polenta",
        "gnocchi",
        "bolognese",
        "casserole",
    ]
    if any(term in text for term in asian_terms) or categories & {"asian", "chinese", "japanese", "korean", "thai", "vietnamese", "indian"}:
        tags.add("asian")
    if any(term in text for term in western_terms) or categories & {"western", "italian", "french", "british", "american", "mediterranean"}:
        tags.add("western")
    if not {"asian", "western"} & tags:
        tags.add("flexibleCuisine")

    if "snackDessert" not in default_roles and re.search(r"\b(salad|vegetable|asparagus|zucchini|cabbage|broccoli|pea|fish|salmon|tofu|beans?)\b", text):
        tags.add("healthy")
    if re.search(r"\b(salad|citrus|lemon|lime|cucumber|tomato|summer|cold noodle|no cook)\b", text):
        tags.update(["light", "hotDay"])
    if re.search(r"\b(stew|soup|brais|roast|bake|risotto|gnocchi|creamy|winter|casserole)\b", text):
        tags.add("cozy")
    if re.search(r"\b(marinat|overnight|chill for|rest for|soak|brine|rise|proof|refrigerate|chill overnight)\b", text):
        tags.add("startEarly")
    if re.search(r"\b(labor-intensive|time-consuming|shape|roll out|fold|stuff|assemble|finely chop|stir constantly)\b", text):
        tags.add("handsOn")
    if re.search(r"\b(stew|soup|curry|brais|big batch|freez|make ahead)\b", text):
        tags.add("keeps")

    seasonal_cues = {
        "spring": ["spring", "asparagus", "rhubarb", "pea", "peas", "radish", "mint"],
        "summer": ["summer", "tomato", "corn", "zucchini", "aubergine", "eggplant", "cucumber", "berry", "peach"],
        "autumn": ["autumn", "fall", "mushroom", "squash", "pumpkin", "apple", "pear", "chestnut"],
        "winter": ["winter", "stew", "soup", "braise", "roast", "cabbage", "leek", "root vegetable", "orange"],
    }
    for season, cues in seasonal_cues.items():
        if season in categories or any(cue in text for cue in cues):
            tags.add(season)

    return sorted(tags)


def clean_ingredient_line(line: str) -> str | None:
    line = re.sub(r"\s+", " ", line).strip()
    if not line:
        return None

    lower = line.lower().strip(":")
    ignored_exact = {
        "ingredients",
        "directions",
        "method",
        "instructions",
        "finally",
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
        "to serve",
        "to garnish",
        "to prepare",
        "to prepare the stew",
        "for serving",
        "for garnish",
    }
    if lower in ignored_exact:
        return None
    if not re.search(r"\d", lower) and (re.match(r"^(for|to)\s+", lower) or re.match(r"^garnish\s+with\b", lower)):
        return None
    if re.fullmatch(r"serves?\s+\d+.*", lower):
        return None
    if re.fullmatch(r"makes?\s+\d+.*", lower):
        return None

    line = re.sub(r"^(\d+(?:[.,]\d+)?)(g|kg|ml|l|dl|oz|lb|lbs)\b", r"\1 \2", line, flags=re.I)
    line = re.sub(r"^(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|dl|oz|lb|lbs))/[^\s]+\s+", r"\1 ", line, flags=re.I)
    line = re.sub(r"\([^)]*(?:optional|if you wish|to taste|see note|shh|to get|about\s+\d+)[^)]*\)", "", line, flags=re.I)
    line = re.sub(r"\([^A-Za-z0-9¼½¾⅓⅔⅛⅜⅝⅞]*\)", "", line)
    line = re.sub(r",\s*(?:cleaned|trimmed|torn|cut|chopped|chop|sliced|slice|diced|dice|minced|mince|grated|shredded|peeled|rinsed|drained|divided|separated|finely|thinly|roughly|coarsely)\b.*", "", line, flags=re.I)
    line = re.sub(r"\b(?:finely|thinly|roughly|coarsely)?\s*(?:cleaned|trimmed|torn|cut|chopped|sliced|diced|minced|grated|shredded|peeled|rinsed|drained)\b\s*", " ", line, flags=re.I)
    line = re.sub(r",?\s*(?:use a bit more if you wish|or more to taste|plus more|to taste|for serving|for garnish)\b.*", "", line, flags=re.I)
    line = re.sub(r"\s+", " ", line).strip(" ,;:-")

    if not line:
        return None
    if not re.search(r"\d|cup|tbsp|tablespoon|tsp|teaspoon|g|kg|ml|l|oz|ounce|pound|lb|pinch|clove|can|bunch|sprig|slice|packet|package", line, re.I):
        words = line.split()
        if len(words) <= 4 and line[:1].isupper():
            return None

    return line


def is_pantry_staple(ingredient: str) -> bool:
    text = ingredient.lower()

    if "olive oil" in text:
        return True
    if re.fullmatch(r".*\b(?:vegetable oil|canola oil|neutral oil|cooking oil)\b.*", text):
        return True
    if re.fullmatch(r".*\b(?:soy sauce|light soy sauce|dark soy sauce|low sodium soy sauce)\b.*", text):
        return True
    if re.fullmatch(r".*\b(?:sesame oil|toasted sesame oil)\b.*", text):
        return True
    if re.fullmatch(r".*\bred wine vinegar\b.*", text):
        return True
    if re.fullmatch(r".*\b(?:butter|unsalted butter|salted butter)\b.*", text):
        return True
    if re.fullmatch(r".*\b(?:water|boiling water|warm water|cold water)\b.*", text):
        return True
    if re.fullmatch(r".*\b(?:white sugar|brown sugar|caster sugar|granulated sugar|sugar)\b.*", text):
        return True
    if re.fullmatch(r".*\b(?:kosher salt|sea salt|fine salt|salt)\b.*", text):
        return True
    if re.fullmatch(r".*\b(?:black pepper|freshly ground black pepper|ground pepper|pepper)\b.*", text):
        return True
    if "salt" in text and "pepper" in text and len(text.split()) <= 8:
        return True

    return False


def split_ingredients(value: str) -> list[str]:
    ingredients: list[str] = []
    seen: set[str] = set()

    for line in value.splitlines():
        cleaned = clean_ingredient_line(line)
        if not cleaned:
            continue

        key = cleaned.lower()
        if key in seen:
            continue
        ingredients.append(cleaned)
        seen.add(key)

    return ingredients


def build_shopping_items(ingredients: list[str]) -> list[dict[str, str]]:
    return [
        {"name": ingredient, "raw": ingredient}
        for ingredient in ingredients
        if not is_pantry_staple(ingredient)
    ]


def normalize_recipe(recipe: dict[str, Any], archive_name: str) -> dict[str, Any]:
    title = recipe.get("name") or Path(archive_name).stem
    leftovers = infer_leftovers(recipe)
    meal_types = infer_meal_types(recipe, leftovers)

    ingredients = split_ingredients(recipe.get("ingredients", ""))
    recipe_role = infer_recipe_role(recipe)
    pair_tags = infer_pairing_tags(recipe)
    effort = infer_effort(recipe)
    default_roles = infer_default_roles(recipe, meal_types, recipe_role)
    default_add_on_roles = infer_add_on_roles(recipe, default_roles)

    return {
        "id": recipe.get("uid") or slugify(title),
        "title": title,
        "paprikaUid": recipe.get("uid", ""),
        "source": recipe.get("source", ""),
        "sourceUrl": recipe.get("source_url", ""),
        "categories": recipe.get("categories", []),
        "servings": recipe.get("servings", ""),
        "prepTime": recipe.get("prep_time", ""),
        "cookTime": recipe.get("cook_time", ""),
        "totalTime": recipe.get("total_time", ""),
        "rating": recipe.get("rating", 0),
        "mealTypes": meal_types,
        "recipeRole": recipe_role,
        "defaultRoles": default_roles,
        "defaultAddOnRole": default_add_on_roles[0] if default_add_on_roles else "",
        "defaultAddOnRoles": default_add_on_roles,
        "defaultRepeatPreference": infer_default_repeat_preference(recipe),
        "defaultTags": infer_default_tags(recipe, effort, default_roles),
        "pairingTags": pair_tags,
        "effort": effort,
        "repeatFrequency": infer_repeat_frequency(recipe),
        "weatherFit": infer_weather_fit(recipe),
        "leftovers": leftovers,
        "ingredients": ingredients,
        "shoppingItems": build_shopping_items(ingredients),
        "directions": recipe.get("directions", ""),
        "notes": recipe.get("notes", ""),
        "imageUrl": recipe.get("image_url", ""),
        "importedAt": date.today().isoformat(),
    }


def import_archive(input_path: Path) -> list[dict[str, Any]]:
    recipes: list[dict[str, Any]] = []

    with zipfile.ZipFile(input_path) as archive:
        for name in sorted(archive.namelist()):
            if not name.endswith(".paprikarecipe"):
                continue

            payload = gzip.decompress(archive.read(name))
            paprika_recipe = json.loads(payload.decode("utf-8"))
            recipes.append(normalize_recipe(paprika_recipe, name))

    return recipes


def dedupe_recipes(recipes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}

    for recipe in recipes:
        key = recipe.get("paprikaUid") or recipe.get("id") or slugify(recipe.get("title", "recipe"))
        deduped[key] = recipe

    return sorted(deduped.values(), key=lambda recipe: recipe["title"].lower())


def recipe_key(recipe: dict[str, Any]) -> str:
    return recipe.get("paprikaUid") or recipe.get("id") or slugify(recipe.get("title", "recipe"))


def comparable_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    ignored_fields = {"importedAt", "updatedAt"}
    return {key: value for key, value in recipe.items() if key not in ignored_fields}


def read_recipe_file(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload if isinstance(payload, list) else []


def backup_file(path: Path, label: str) -> Path | None:
    if not path.exists():
        return None

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_name(f"{path.stem}.backup-{label}-{timestamp}{path.suffix}")
    shutil.copy2(path, backup_path)
    return backup_path


def build_import_summary(
  previous_recipes: list[dict[str, Any]],
  next_recipes: list[dict[str, Any]],
) -> dict[str, Any]:
    previous_by_key = {recipe_key(recipe): recipe for recipe in previous_recipes}
    next_by_key = {recipe_key(recipe): recipe for recipe in next_recipes}

    added: list[str] = []
    updated: list[str] = []
    unchanged: list[str] = []
    missing: list[str] = []

    for key, recipe in next_by_key.items():
        previous = previous_by_key.get(key)
        if previous is None:
            added.append(recipe["title"])
        elif comparable_recipe(previous) == comparable_recipe(recipe):
            unchanged.append(recipe["title"])
        else:
            updated.append(recipe["title"])

    for key, recipe in previous_by_key.items():
        if key not in next_by_key:
            missing.append(recipe["title"])

    return {
        "previousCount": len(previous_recipes),
        "recipeCount": len(next_recipes),
        "addedCount": len(added),
        "updatedCount": len(updated),
        "unchangedCount": len(unchanged),
        "missingCount": len(missing),
        "added": sorted(added),
        "updated": sorted(updated),
        "missing": sorted(missing),
    }


def preserve_import_metadata(
  previous_recipes: list[dict[str, Any]],
  next_recipes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    previous_by_key = {recipe_key(recipe): recipe for recipe in previous_recipes}
    today = date.today().isoformat()
    merged: list[dict[str, Any]] = []

    for recipe in next_recipes:
        previous = previous_by_key.get(recipe_key(recipe))
        if previous is None:
            recipe["importedAt"] = today
        else:
            recipe["importedAt"] = previous.get("importedAt") or today
            previous_updated_at = previous.get("updatedAt")
            if comparable_recipe(previous) != comparable_recipe(recipe):
                recipe["updatedAt"] = today
            elif previous_updated_at:
                recipe["updatedAt"] = previous_updated_at
        merged.append(recipe)

    return sorted(merged, key=lambda recipe: recipe["title"].lower())


def update_recipe_file(
  input_paths: list[Path],
  output_path: Path,
  state_path: Path | None = None,
  backup: bool = True,
) -> dict[str, Any]:
    previous_recipes = read_recipe_file(output_path)

    imported_recipes: list[dict[str, Any]] = []
    for input_path in input_paths:
        imported_recipes.extend(import_archive(input_path))

    next_recipes = dedupe_recipes(imported_recipes)
    summary = build_import_summary(previous_recipes, next_recipes)
    next_recipes = preserve_import_metadata(previous_recipes, next_recipes)

    backups: dict[str, str] = {}
    if backup:
        recipes_backup = backup_file(output_path, "pre-import")
        if recipes_backup:
            backups["recipes"] = str(recipes_backup)
        if state_path:
            state_backup = backup_file(state_path, "pre-import")
            if state_backup:
                backups["state"] = str(state_backup)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(next_recipes, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    summary["inputFiles"] = [str(path) for path in input_paths]
    summary["output"] = str(output_path)
    summary["backups"] = backups
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, nargs="+")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "recipes.json",
    )
    parser.add_argument(
        "--state",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "app-state.json",
        help="App state file to back up before importing.",
    )
    parser.add_argument("--no-backup", action="store_true", help="Skip backup files.")
    args = parser.parse_args()

    summary = update_recipe_file(
        args.input,
        output_path=args.output,
        state_path=args.state,
        backup=not args.no_backup,
    )
    print(f"Imported {summary['recipeCount']} recipes to {args.output}")
    print(
        "Summary: "
        f"{summary['addedCount']} added, "
        f"{summary['updatedCount']} updated, "
        f"{summary['unchangedCount']} unchanged, "
        f"{summary['missingCount']} no longer in import."
    )
    if summary["backups"]:
        print("Backups:")
        for label, path in summary["backups"].items():
            print(f"  {label}: {path}")


if __name__ == "__main__":
    main()
