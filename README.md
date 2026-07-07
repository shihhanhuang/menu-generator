# Menu Generator

A personal weekly menu planner for household cooking, built from Paprika recipe exports.

## Run the app

From this folder:

```bash
python3 server.py
```

Then open:

```text
http://127.0.0.1:5178/
```

Use the `http://127.0.0.1:5178/` address rather than opening `index.html` directly. Opening the app as `file://` can split recipe memory into a separate browser storage area.

## Mobile or server access

For quick access from a phone on the same Wi-Fi as the laptop, run:

```bash
MENU_HOST=0.0.0.0 MENU_PORT=5178 python3 server.py
```

Then open the laptop's local network address from the phone, for example:

```text
http://192.168.x.x:5178/
```

For a household server, copy this folder to the server, keep `data/app-state.json`, `data/recipes.json`, and `imports/`, then run the same command above from the app folder. A reverse proxy can point a friendly URL to port `5178` if desired.

## Beni's server / rxtx.io

This repo is set up to build a Docker image with GitHub Actions and publish it to:

```text
ghcr.io/shihhanhuang/menu-generator:latest
```

Details for Beni:

- GitHub username: `shihhanhuang`
- Repo/image name: `menu-generator`
- Persistent data folder: `/data/menu-generator`
- App port: `5178`

On first server run, the app seeds `/data/menu-generator/recipes.json` and `/data/menu-generator/app-state.json` from the repo copy if those files do not already exist. After that, the `/data/menu-generator` copy is the durable source of truth.

After the first GitHub Actions build, check GitHub Packages for `menu-generator` and make the container package public if Beni's server will pull it without GitHub credentials:

```text
GitHub profile -> Packages -> menu-generator -> Package settings -> Change visibility -> Public
```

The workflow can also trigger Watchtower after each build. Add this repository secret in GitHub to enable that deploy trigger:

```text
WATCHTOWER_TOKEN
```

Without that secret, the image still builds and pushes to GHCR, but the Watchtower trigger step is skipped.

## Where data lives

- Recipes imported from Paprika: `data/recipes.json`
- Shared recipe memory and current app state: `data/app-state.json`

`data/app-state.json` stores reviewed status, repeat preferences, roles, planning tags, comments, app-only display names, hidden-from-planner choices, locked days, custom meal notes, and added dishes. It is shared by browsers that use the local server URL.

## Current recovered state

As of July 1, 2026, the shared state contains:

- 50 recipes with feedback records
- 47 reviewed recipes

## Import Paprika recipes

Put Paprika `.paprikarecipes` exports in:

```text
imports/
```

Then open the Import tab, choose the export file(s) to use, and click **Update recipes**. Import files are not preselected, so each update is deliberate. The app refreshes `data/recipes.json`, preserves app-only recipe memory in `data/app-state.json`, and backs up both files first.

Current terminal command, if needed:

```bash
python3 scripts/import_paprika.py "imports/Favorites 20260630.paprikarecipes" --output data/recipes.json
```

After importing, run the app through `server.py` so recipe memory continues to save into `data/app-state.json`.

Paprika imports refresh `data/recipes.json`. App-only choices such as display names, hidden recipes, repeat preference, tags, and comments live separately in `data/app-state.json`, so they are preserved across imports as long as that state file is kept. Recipes not present in the latest import set are removed from the active recipe library, but their app-state memory remains available if they are imported again later.

## Reference notes

Longer reference notes live in:

```text
reference/
```

- `reference/paprika-update-workflow.md`
- `reference/planner-tags.md`

## Backups

Before large review sessions or import changes, make a copy of:

```text
data/app-state.json
```

That file is the important one for preserving recipe review work.
