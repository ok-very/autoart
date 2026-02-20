"""
Artist Records service — orchestrates scanning, manifest generation, and DB caching.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from autohelper.config import get_settings
from autohelper.db import get_db
from autohelper.shared.ids import generate_request_id

from .config import get_lexicon, MANIFEST_FILENAME
from .generator import build_manifest, write_manifest_to_disk
from .resolver import resolve_artists
from .scanner import ArtistScanner
from .utils import extract_text

logger = logging.getLogger(__name__)

# Singleton
_service: ArtistService | None = None


def get_artist_service() -> ArtistService:
    global _service
    if _service is None:
        _service = ArtistService()
    return _service


class ArtistService:
    """Orchestrates artist scanning, manifest generation, and DB caching."""

    def __init__(self) -> None:
        self._scanning = False

    @property
    def is_scanning(self) -> bool:
        return self._scanning

    # ------------------------------------------------------------------
    # Full scan
    # ------------------------------------------------------------------

    def full_scan(self) -> dict[str, Any]:
        """Scan all categories, resolve, generate manifests, cache in DB."""
        if self._scanning:
            return {"error": "Scan already in progress"}

        settings = get_settings()
        storage_root = getattr(settings, "artist_storage_root", "")
        if not storage_root or not Path(storage_root).is_dir():
            return {"error": f"Invalid storage root: {storage_root}"}

        self._scanning = True
        run_id = generate_request_id()
        db = get_db()

        try:
            # Record scan start
            db.execute(
                "INSERT INTO artist_scan_runs (run_id, kind, status) VALUES (?, ?, ?)",
                (run_id, "full", "running"),
            )
            db.commit()

            # Scan
            scanner = ArtistScanner(Path(storage_root))
            records = scanner.scan_all()
            logger.info("Scanned %d folder records", len(records))

            # Resolve
            resolved = resolve_artists(records)
            logger.info("Resolved to %d unique artists", len(resolved))

            # Enrich contacts from existing contact_sync_contacts table
            self._enrich_contacts(resolved)

            # Generate manifests and cache
            self._clear_cache(db)
            for artist in resolved:
                manifest = build_manifest(artist)
                write_manifest_to_disk(manifest, artist)
                self._cache_artist(db, manifest, artist)

            db.commit()

            # Update scan run
            stats = {
                "folder_records": len(records),
                "artists": len(resolved),
            }
            db.execute(
                """UPDATE artist_scan_runs
                   SET finished_at = datetime('now'), status = 'completed', stats_json = ?
                   WHERE run_id = ?""",
                (json.dumps(stats), run_id),
            )
            db.commit()

            logger.info("Full scan complete: %d artists", len(resolved))
            return stats

        except Exception as e:
            logger.error("Full scan failed: %s", e, exc_info=True)
            db.execute(
                """UPDATE artist_scan_runs
                   SET finished_at = datetime('now'), status = 'failed', stats_json = ?
                   WHERE run_id = ?""",
                (json.dumps({"error": str(e)}), run_id),
            )
            db.commit()
            return {"error": str(e)}
        finally:
            self._scanning = False

    # ------------------------------------------------------------------
    # Single-artist rescan
    # ------------------------------------------------------------------

    def rescan_folder(self, folder_path: str) -> dict[str, Any]:
        """Rescan a single folder, identify the artist, rebuild their manifest."""
        db = get_db()

        # Look up artist_id from folder
        row = db.execute(
            "SELECT artist_id FROM artist_folders WHERE folder_path = ?",
            (folder_path,),
        ).fetchone()
        if not row:
            logger.debug("No artist found for folder: %s", folder_path)
            return {"status": "unknown_folder"}

        artist_id = row[0]
        return self.rescan_artist(artist_id)

    def rescan_artist(self, artist_id: str) -> dict[str, Any]:
        """Re-scan all folders for one artist, rebuild their manifest."""
        db = get_db()

        # Get all folders for this artist
        rows = db.execute(
            "SELECT folder_path, category, nation FROM artist_folders WHERE artist_id = ?",
            (artist_id,),
        ).fetchall()
        if not rows:
            return {"error": "Artist not found"}

        scanner = ArtistScanner.__new__(ArtistScanner)
        records = []
        for folder_path, category, nation in rows:
            if Path(folder_path).is_dir():
                record = scanner.scan_single_folder(
                    Path(folder_path), category, nation
                )
                records.append(record)

        if not records:
            return {"error": "No accessible folders"}

        resolved = resolve_artists(records)
        if not resolved:
            return {"error": "Resolution failed"}

        artist = resolved[0]
        self._enrich_contacts([artist])
        manifest = build_manifest(artist)
        write_manifest_to_disk(manifest, artist)
        self._cache_artist(db, manifest, artist)
        db.commit()

        logger.info("Rescanned artist: %s", artist_id)
        return {"status": "ok", "artist_id": artist_id}

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def _has_artists_table(self) -> bool:
        """Check if the artists table exists (migration 0009 may not have run)."""
        db = get_db()
        row = db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='artists'"
        ).fetchone()
        return row is not None

    def get_artists(
        self,
        q: str = "",
        category: str = "",
        min_completeness: float = 0.0,
        max_completeness: float = 1.0,
        review_status: str = "",
        nation: str = "",
        offset: int = 0,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        """Query cached artist data with filters."""
        if not self._has_artists_table():
            return []

        db = get_db()
        conditions = ["1=1"]
        params: list[Any] = []

        if q:
            conditions.append("display_name LIKE ?")
            params.append(f"%{q}%")

        if category:
            conditions.append("categories LIKE ?")
            params.append(f'%"{category}"%')

        if nation:
            conditions.append("nations LIKE ?")
            params.append(f'%"{nation}"%')

        conditions.append("completeness >= ?")
        params.append(min_completeness)
        conditions.append("completeness <= ?")
        params.append(max_completeness)

        if review_status:
            conditions.append("review_status = ?")
            params.append(review_status)

        where = " AND ".join(conditions)
        params.extend([limit, offset])

        rows = db.execute(
            f"""SELECT artist_id, display_name, first_name, last_name,
                       completeness, has_bio, has_cv, has_tearsheet, has_contact, has_images,
                       review_status, categories, nations, identity_tags, primary_folder
                FROM artists
                WHERE {where}
                ORDER BY display_name
                LIMIT ? OFFSET ?""",
            params,
        ).fetchall()

        return [
            {
                "artist_id": r[0],
                "display_name": r[1],
                "first_name": r[2],
                "last_name": r[3],
                "completeness": r[4],
                "has_bio": bool(r[5]),
                "has_cv": bool(r[6]),
                "has_tearsheet": bool(r[7]),
                "has_contact": bool(r[8]),
                "has_images": bool(r[9]),
                "review_status": r[10],
                "categories": json.loads(r[11] or "[]"),
                "nations": json.loads(r[12] or "[]"),
                "identity_tags": json.loads(r[13] or "[]"),
                "primary_folder": r[14],
            }
            for r in rows
        ]

    def get_artist(self, artist_id: str) -> dict[str, Any] | None:
        """Get full manifest for one artist from cache."""
        if not self._has_artists_table():
            return None
        db = get_db()
        row = db.execute(
            "SELECT manifest_json FROM artists WHERE artist_id = ?",
            (artist_id,),
        ).fetchone()
        if not row:
            return None
        return json.loads(row[0])

    def get_stats(self) -> dict[str, Any]:
        """Aggregate statistics for the dashboard header."""
        if not self._has_artists_table():
            return {
                "total": 0, "avg_completeness": 0, "needs_review": 0,
                "by_category": {}, "by_review_status": {},
                "completeness_by_field": {},
                "all_nations": [], "all_identity_tags": [],
            }

        db = get_db()

        total = db.execute("SELECT COUNT(*) FROM artists").fetchone()[0]
        avg_score = db.execute(
            "SELECT COALESCE(AVG(completeness), 0) FROM artists"
        ).fetchone()[0]

        # Count by category
        all_categories = db.execute("SELECT categories FROM artists").fetchall()
        cat_counts: dict[str, int] = {}
        for (cats_json,) in all_categories:
            for cat in json.loads(cats_json or "[]"):
                cat_counts[cat] = cat_counts.get(cat, 0) + 1

        # Count by review status
        review_counts = {}
        for row in db.execute(
            "SELECT review_status, COUNT(*) FROM artists GROUP BY review_status"
        ).fetchall():
            review_counts[row[0]] = row[1]

        # All nations
        all_nations_set: set[str] = set()
        for (nations_json,) in db.execute("SELECT nations FROM artists").fetchall():
            for n in json.loads(nations_json or "[]"):
                all_nations_set.add(n)

        # All identity tags (identities like queer, PoC, diaspora, etc.)
        all_identity_tags_set: set[str] = set()
        for (tags_json,) in db.execute("SELECT identity_tags FROM artists").fetchall():
            for t in json.loads(tags_json or "[]"):
                all_identity_tags_set.add(t)

        # Needs review count (has review notes)
        needs_review = 0
        for (mj,) in db.execute("SELECT manifest_json FROM artists").fetchall():
            try:
                m = json.loads(mj)
                if m.get("_review_notes"):
                    needs_review += 1
            except (json.JSONDecodeError, TypeError):
                pass

        # Per-field completeness rates (for bar chart)
        field_cols = ["has_bio", "has_cv", "has_tearsheet", "has_contact", "has_images"]
        completeness_by_field: dict[str, float] = {}
        if total > 0:
            for col in field_cols:
                count = db.execute(f"SELECT SUM({col}) FROM artists").fetchone()[0] or 0
                completeness_by_field[col] = round(count / total, 3)

        return {
            "total": total,
            "avg_completeness": round(avg_score, 3),
            "needs_review": needs_review,
            "by_category": cat_counts,
            "by_review_status": review_counts,
            "completeness_by_field": completeness_by_field,
            "all_nations": sorted(all_nations_set),
            "all_identity_tags": sorted(all_identity_tags_set),
        }

    def get_health_report(self) -> dict[str, Any]:
        """Build a health report: ranking, gap analysis, broken items, enrichment opps, review queue."""
        if not self._has_artists_table():
            return {
                "ranking": [], "gap_analysis": {},
                "broken": [], "enrichment": [], "review_queue": [],
            }

        db = get_db()

        # Fetch all artists with manifest
        rows = db.execute(
            """SELECT artist_id, display_name, completeness,
                      has_bio, has_cv, has_tearsheet, has_contact, has_images,
                      review_status, categories, primary_folder, manifest_json
               FROM artists ORDER BY completeness ASC"""
        ).fetchall()

        ranking = []
        broken = []
        enrichment = []
        review_queue = []
        gap_totals: dict[str, dict[str, int]] = {}
        gap_fields = {
            "bio": 3, "cv": 4, "tearsheet": 5, "email": 6, "images": 7,
        }
        total = len(rows)

        for r in rows:
            artist_id = r[0]
            display_name = r[1]
            score = r[2]
            categories = json.loads(r[9] or "[]")
            primary_folder = r[10]
            manifest_json = r[11]

            # Parse gaps from manifest
            gaps = []
            try:
                m = json.loads(manifest_json) if manifest_json else {}
                comp = m.get("completeness", {})
                gaps = comp.get("gaps", [])
                notes = m.get("_review_notes", [])

                # Enrichment: missing bio, contact email, images, website
                missing_fields = []
                if not comp.get("has_bio"):
                    missing_fields.append("Bio")
                if not comp.get("has_contact_email"):
                    missing_fields.append("Email")
                if not comp.get("has_images"):
                    missing_fields.append("Images")
                if not comp.get("has_website"):
                    missing_fields.append("Website")
                if not comp.get("has_pronouns"):
                    missing_fields.append("Pronouns")
                if not comp.get("has_contact_phone"):
                    missing_fields.append("Phone")

                if missing_fields and score < 0.8:
                    enrichment.append({
                        "artist_id": artist_id,
                        "display_name": display_name,
                        "missing": missing_fields,
                        "score": score,
                    })

                # Review queue: pending status or has notes
                if r[8] == "pending" or r[8] == "flagged" or notes:
                    review_queue.append({
                        "artist_id": artist_id,
                        "display_name": display_name,
                        "review_status": r[8] or "pending",
                        "note_count": len(notes),
                    })
            except (json.JSONDecodeError, TypeError):
                pass

            # Ranking entry
            ranking.append({
                "artist_id": artist_id,
                "display_name": display_name,
                "score": score,
                "categories": categories,
                "gaps": gaps,
            })

            # Broken detection: primary folder missing or empty manifest
            if primary_folder and not Path(primary_folder).is_dir():
                broken.append({
                    "artist_id": artist_id,
                    "display_name": display_name,
                    "reason": "Primary folder missing",
                })
            elif not manifest_json or manifest_json == "{}":
                broken.append({
                    "artist_id": artist_id,
                    "display_name": display_name,
                    "reason": "Empty manifest",
                })

            # Gap analysis pivot
            for field_name, col_idx in gap_fields.items():
                if field_name not in gap_totals:
                    gap_totals[field_name] = {"missing": 0, "total": total}
                if not r[col_idx]:
                    gap_totals[field_name]["missing"] += 1

        # Add phone/website/pronouns from manifest data
        phone_missing = 0
        website_missing = 0
        pronouns_missing = 0
        for r in rows:
            try:
                m = json.loads(r[11]) if r[11] else {}
                comp = m.get("completeness", {})
                if not comp.get("has_contact_phone"):
                    phone_missing += 1
                if not comp.get("has_website"):
                    website_missing += 1
                if not comp.get("has_pronouns"):
                    pronouns_missing += 1
            except (json.JSONDecodeError, TypeError):
                pass

        gap_totals["phone"] = {"missing": phone_missing, "total": total}
        gap_totals["website"] = {"missing": website_missing, "total": total}
        gap_totals["pronouns"] = {"missing": pronouns_missing, "total": total}

        return {
            "ranking": ranking,
            "gap_analysis": gap_totals,
            "broken": broken,
            "enrichment": enrichment,
            "review_queue": review_queue,
        }

    def get_bio_content(self, artist_id: str) -> str | None:
        """Read and return inline bio text from the current bio file."""
        manifest = self.get_artist(artist_id)
        if not manifest:
            return None

        bios = manifest.get("documents", {}).get("bios", [])
        # Find the current bio
        current_bio = next((b for b in bios if b.get("is_current")), None)
        if not current_bio:
            current_bio = bios[0] if bios else None
        if not current_bio:
            return None

        file_path = current_bio.get("file_path", "")
        if not file_path or not os.path.isfile(file_path):
            return None

        return extract_text(file_path)

    def get_scan_status(self) -> dict[str, Any]:
        """Current scan status."""
        db = get_db()
        try:
            row = db.execute(
                """SELECT run_id, kind, started_at, finished_at, status, stats_json
                   FROM artist_scan_runs ORDER BY started_at DESC LIMIT 1"""
            ).fetchone()
        except Exception:
            # Table may not exist yet (migration 0009 not applied)
            return {"is_scanning": self._scanning, "last_run": None}
        if not row:
            return {"is_scanning": self._scanning, "last_run": None}
        return {
            "is_scanning": self._scanning,
            "last_run": {
                "run_id": row[0],
                "kind": row[1],
                "started_at": row[2],
                "finished_at": row[3],
                "status": row[4],
                "stats": json.loads(row[5]) if row[5] else None,
            },
        }

    def update_review(self, artist_id: str, status: str) -> None:
        """Set review_status in DB."""
        db = get_db()
        db.execute(
            "UPDATE artists SET review_status = ?, updated_at = datetime('now') WHERE artist_id = ?",
            (status, artist_id),
        )
        db.commit()

    def save_manifest(self, artist_id: str, data: dict[str, Any]) -> None:
        """Save edited manifest fields to disk and update DB cache."""
        db = get_db()
        row = db.execute(
            "SELECT manifest_json, primary_folder FROM artists WHERE artist_id = ?",
            (artist_id,),
        ).fetchone()
        if not row:
            return

        manifest = json.loads(row[0])
        primary_folder = row[1]

        # Merge editable fields
        if "identity" in data:
            manifest.setdefault("identity", {}).update(data["identity"])
        if "contact" in data:
            manifest.setdefault("contact", {}).update(data["contact"])

        # Write to disk
        manifest_path = os.path.join(primary_folder, "artist_manifest.json")
        disk_data = dict(manifest)
        # Strip internal keys before writing
        for k in list(disk_data.keys()):
            if k.startswith("_file"):
                del disk_data[k]
        with open(manifest_path, "w", encoding="utf-8") as fh:
            json.dump(disk_data, fh, indent=2, ensure_ascii=False)

        # Update DB cache
        manifest_json = json.dumps(manifest, ensure_ascii=False)
        db.execute(
            """UPDATE artists SET manifest_json = ?, display_name = ?,
               updated_at = datetime('now') WHERE artist_id = ?""",
            (manifest_json, manifest.get("identity", {}).get("display_name", ""), artist_id),
        )
        db.commit()

    def resolve_note(self, artist_id: str, index: int) -> None:
        """Remove a review note by index from manifest and save."""
        db = get_db()
        row = db.execute(
            "SELECT manifest_json, primary_folder FROM artists WHERE artist_id = ?",
            (artist_id,),
        ).fetchone()
        if not row:
            return

        manifest = json.loads(row[0])
        notes = manifest.get("_review_notes", [])
        if 0 <= index < len(notes):
            notes.pop(index)
            manifest["_review_notes"] = notes

            # Write to disk
            primary_folder = row[1]
            manifest_path = os.path.join(primary_folder, "artist_manifest.json")
            with open(manifest_path, "w", encoding="utf-8") as fh:
                json.dump(manifest, fh, indent=2, ensure_ascii=False)

            # Update DB
            db.execute(
                "UPDATE artists SET manifest_json = ?, updated_at = datetime('now') WHERE artist_id = ?",
                (json.dumps(manifest, ensure_ascii=False), artist_id),
            )
            db.commit()

    def add_panel_entry(self, artist_id: str, entry: dict[str, Any]) -> None:
        """Append a panel entry to manifest."""
        db = get_db()
        row = db.execute(
            "SELECT manifest_json, primary_folder FROM artists WHERE artist_id = ?",
            (artist_id,),
        ).fetchone()
        if not row:
            return

        manifest = json.loads(row[0])
        eng = manifest.setdefault("engagement", {})
        history = eng.setdefault("panel_history", [])
        history.append({
            "date": entry.get("date"),
            "project": entry.get("project"),
            "role": entry.get("role", "selection_panel"),
        })
        eng["panel_count"] = len(history)

        self._save_manifest_to_disk_and_db(db, manifest, row[1], artist_id)

    def add_project(self, artist_id: str, project: dict[str, Any]) -> None:
        """Append a public art project entry to manifest."""
        db = get_db()
        row = db.execute(
            "SELECT manifest_json, primary_folder FROM artists WHERE artist_id = ?",
            (artist_id,),
        ).fetchone()
        if not row:
            return

        manifest = json.loads(row[0])
        eng = manifest.setdefault("engagement", {})
        projects = eng.setdefault("public_art_projects", [])
        projects.append({
            "project_name": project.get("project_name", ""),
            "developer": project.get("developer"),
            "year": project.get("year"),
            "role": project.get("role"),
            "status": project.get("status", "submitted"),
            "status_date": project.get("status_date"),
            "eoi_ref": project.get("eoi_ref"),
        })

        self._save_manifest_to_disk_and_db(db, manifest, row[1], artist_id)

    def update_project_status(
        self, artist_id: str, project_index: int, status: str, status_date: str | None = None
    ) -> None:
        """Advance a project through pipeline stages."""
        valid_stages = {"submitted", "longlisted", "shortlisted", "awarded", "completed"}
        if status not in valid_stages:
            return

        db = get_db()
        row = db.execute(
            "SELECT manifest_json, primary_folder FROM artists WHERE artist_id = ?",
            (artist_id,),
        ).fetchone()
        if not row:
            return

        manifest = json.loads(row[0])
        projects = manifest.get("engagement", {}).get("public_art_projects", [])
        if 0 <= project_index < len(projects):
            projects[project_index]["status"] = status
            if status_date:
                projects[project_index]["status_date"] = status_date

        self._save_manifest_to_disk_and_db(db, manifest, row[1], artist_id)

    def _save_manifest_to_disk_and_db(
        self, db: Any, manifest: dict, primary_folder: str, artist_id: str
    ) -> None:
        """Write manifest dict to disk JSON and update DB cache."""
        manifest_path = os.path.join(primary_folder, "artist_manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=2, ensure_ascii=False)
        db.execute(
            "UPDATE artists SET manifest_json = ?, updated_at = datetime('now') WHERE artist_id = ?",
            (json.dumps(manifest, ensure_ascii=False), artist_id),
        )
        db.commit()

    # ------------------------------------------------------------------
    # Contact enrichment
    # ------------------------------------------------------------------

    def _enrich_contacts(self, resolved: list[dict[str, Any]]) -> None:
        """Enrich resolved artists with contact data from contact_sync_contacts table."""
        db = get_db()

        # Check if the table exists (contacts module may not have run yet)
        table_check = db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='contact_sync_contacts'"
        ).fetchone()
        if not table_check:
            return

        # Load all contacts into a lookup by email
        rows = db.execute(
            "SELECT email_primary, row_hash FROM contact_sync_contacts"
        ).fetchall()
        if not rows:
            return

        # For now, contacts don't have name fields in the sync table,
        # so we skip automatic enrichment. The user's existing contacts
        # CSV data will be available through the contact sync module.
        # Future: add first_name/last_name to contact_sync_contacts for matching.

    # ------------------------------------------------------------------
    # DB cache
    # ------------------------------------------------------------------

    def _clear_cache(self, db: Any) -> None:
        """Clear all cached artist data."""
        db.execute("DELETE FROM artist_folders")
        db.execute("DELETE FROM artists")

    def _cache_artist(self, db: Any, manifest: Any, artist: dict[str, Any]) -> None:
        """Upsert one artist + folders into the cache tables."""
        manifest_json = json.dumps(manifest.model_dump_json_friendly(), ensure_ascii=False)

        db.execute(
            """INSERT OR REPLACE INTO artists
               (artist_id, display_name, first_name, last_name, manifest_json,
                completeness, has_bio, has_cv, has_tearsheet, has_contact, has_images,
                review_status, primary_folder, categories, identity_tags, nations,
                scanned_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))""",
            (
                manifest.artist_id,
                manifest.identity.display_name,
                manifest.identity.first_name,
                manifest.identity.last_name,
                manifest_json,
                manifest.completeness.score,
                int(manifest.completeness.has_bio),
                int(manifest.completeness.has_cv),
                int(manifest.completeness.has_tearsheet),
                int(manifest.completeness.has_contact_email),
                int(manifest.completeness.has_images),
                "pending",
                artist["primary_folder_path"],
                json.dumps(artist.get("categories", [])),
                json.dumps(manifest.identity.identity_tags.identities),
                json.dumps([a.name for a in manifest.identity.identity_tags.affiliations if a.type == "nation"]),
            ),
        )

        # Cache folder locations
        for fl in artist.get("folder_locations", []):
            folder_id = generate_request_id()
            db.execute(
                """INSERT OR REPLACE INTO artist_folders
                   (folder_id, artist_id, folder_path, category, layout, nation, is_primary)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    folder_id,
                    manifest.artist_id,
                    fl["folder_path"],
                    fl["category"],
                    "nation_based" if fl.get("nation") else "flat",
                    fl.get("nation"),
                    int(fl["is_primary"]),
                ),
            )
