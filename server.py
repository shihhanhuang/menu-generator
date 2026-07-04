#!/usr/bin/env python3
"""Local menu-generator server with shared JSON state."""

from __future__ import annotations

import json
import os
import shutil
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
SEED_DATA_PATH = ROOT / "data"
DATA_PATH = Path(os.environ.get("MENU_DATA_DIR", str(SEED_DATA_PATH))).resolve()
STATE_PATH = DATA_PATH / "app-state.json"
RECIPES_PATH = DATA_PATH / "recipes.json"
IMPORTS_PATH = DATA_PATH / "imports"
HOST = os.environ.get("MENU_HOST", "127.0.0.1")
PORT = int(os.environ.get("MENU_PORT", "5178"))

sys.path.insert(0, str(ROOT / "scripts"))
from import_paprika import update_recipe_file  # noqa: E402


class MenuHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/api/state":
            self.send_json(read_state())
            return
        if self.path == "/api/imports":
            self.send_json(list_imports())
            return
        if self.path == "/data/recipes.json":
            self.send_file(RECIPES_PATH, "application/json; charset=utf-8")
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path == "/api/state":
            payload = self.read_json()
            write_state(payload if isinstance(payload, dict) else {})
            self.send_json(read_state())
            return
        if self.path == "/api/import":
            payload = self.read_json()
            try:
                input_paths = select_import_files(payload if isinstance(payload, dict) else {})
                summary = update_recipe_file(
                    input_paths,
                    output_path=RECIPES_PATH,
                    state_path=STATE_PATH,
                    backup=True,
                )
                self.send_json(summary)
            except ValueError as error:
                self.send_json({"message": str(error)}, status=400)
            return
        self.send_error(404)

    def read_json(self) -> Any:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def send_json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path, content_type: str) -> None:
        if not path.exists():
            self.send_error(404)
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def initialize_data_dir() -> None:
    DATA_PATH.mkdir(parents=True, exist_ok=True)
    IMPORTS_PATH.mkdir(parents=True, exist_ok=True)

    for filename in ("recipes.json", "app-state.json"):
        target = DATA_PATH / filename
        source = SEED_DATA_PATH / filename
        if target.exists() or not source.exists() or target.resolve() == source.resolve():
            continue
        shutil.copy2(source, target)


def read_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {}
    try:
        payload = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def write_state(payload: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def list_imports() -> dict[str, Any]:
    IMPORTS_PATH.mkdir(parents=True, exist_ok=True)
    files = []

    for path in sorted(IMPORTS_PATH.glob("*.paprikarecipes"), key=lambda item: (-item.stat().st_mtime, item.name.lower())):
        stat = path.stat()
        files.append(
            {
                "name": path.name,
                "size": stat.st_size,
                "modified": stat.st_mtime,
            }
        )

    return {"files": files}


def select_import_files(payload: dict[str, Any]) -> list[Path]:
    requested_files = payload.get("files")
    if requested_files is None:
        paths = sorted(IMPORTS_PATH.glob("*.paprikarecipes"), key=lambda item: item.name.lower())
    elif isinstance(requested_files, list):
        paths = []
        for name in requested_files:
            if not isinstance(name, str) or not name:
                raise ValueError("Import file names must be strings.")
            if "/" in name or "\\" in name or name.startswith("."):
                raise ValueError("Import file names must come from the imports folder.")
            path = IMPORTS_PATH / name
            if path.suffix != ".paprikarecipes" or not path.exists():
                raise ValueError(f"Import file not found: {name}")
            paths.append(path)
    else:
        raise ValueError("files must be a list of import file names.")

    if not paths:
        raise ValueError("No .paprikarecipes files were found in the imports folder.")
    return paths


def main() -> None:
    initialize_data_dir()
    server = ThreadingHTTPServer((HOST, PORT), MenuHandler)
    print(f"Serving menu generator on http://{HOST}:{PORT}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
