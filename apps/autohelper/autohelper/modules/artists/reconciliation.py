"""
Comprehensive reconciliation engine: surfaces data quality issues across
all artist record fields — engagement pipeline, identities, affiliations,
names/aliases, locations, and potential duplicates.

Reports:
  Engagement:
  - orphan_eois: EOI entries not linked to any project pipeline record
  - orphan_proposals: concept proposals not linked to any project
  - stalled_projects: projects stuck at a stage
  - fuzzy_matches: EOI/proposal names that approximately match a project name
  - panel_gaps: artists who served on panels but have no project records

  Data quality:
  - duplicate_artists: artists with very similar display names (possible dupes)
  - affiliation_variants: near-match affiliation names across all artists
  - identity_inconsistencies: near-duplicate identity tags across the corpus
  - alias_conflicts: multiple artists sharing the same name entry
  - location_variants: near-match location place names across artists
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from difflib import SequenceMatcher
from typing import Any

from autohelper.db import get_db

logger = logging.getLogger(__name__)


def _normalize(s: str) -> str:
    """Lowercase, strip, collapse whitespace."""
    return " ".join(s.lower().split())


def _similarity(a: str, b: str) -> float:
    """Normalized string similarity (0-1)."""
    return SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


# ------------------------------------------------------------------
# Report builder
# ------------------------------------------------------------------

def get_reconciliation_report() -> dict[str, Any]:
    """Build the full reconciliation report from all cached artist manifests."""
    db = get_db()

    try:
        rows = db.execute(
            "SELECT artist_id, display_name, manifest_json FROM artists"
        ).fetchall()
    except Exception:
        return _empty_report()

    # Parse all manifests once
    artists: list[tuple[str, str, dict]] = []
    for artist_id, display_name, manifest_json in rows:
        if not manifest_json:
            continue
        try:
            m = json.loads(manifest_json)
        except (json.JSONDecodeError, TypeError):
            continue
        artists.append((artist_id, display_name, m))

    report = {}

    # Engagement reconciliation
    report.update(_engagement_report(artists))

    # Data quality reconciliation
    report.update(_data_quality_report(artists))

    return report


def _empty_report() -> dict[str, list]:
    return {
        "orphan_eois": [], "orphan_proposals": [],
        "stalled_projects": [], "fuzzy_matches": [], "panel_gaps": [],
        "duplicate_artists": [], "affiliation_variants": [],
        "identity_inconsistencies": [], "alias_conflicts": [],
        "location_variants": [],
    }


# ------------------------------------------------------------------
# Engagement pipeline reconciliation
# ------------------------------------------------------------------

def _engagement_report(artists: list[tuple[str, str, dict]]) -> dict[str, list]:
    orphan_eois: list[dict] = []
    orphan_proposals: list[dict] = []
    stalled_projects: list[dict] = []
    fuzzy_matches: list[dict] = []
    panel_gaps: list[dict] = []

    for artist_id, display_name, m in artists:
        eng = m.get("engagement", {})
        projects = eng.get("public_art_projects", [])
        eois = eng.get("eois", [])
        proposals = eng.get("concept_proposals", [])
        panel_history = eng.get("panel_history", [])

        project_names = {
            _normalize(p["project_name"])
            for p in projects if p.get("project_name")
        }

        # Orphan EOIs
        for eoi in eois:
            eoi_name = eoi.get("project_name") or ""
            if not eoi_name:
                continue
            norm_eoi = _normalize(eoi_name)
            if norm_eoi not in project_names:
                best_score, best_match = _best_fuzzy(norm_eoi, project_names)
                if best_score >= 0.7:
                    fuzzy_matches.append({
                        "artist_id": artist_id,
                        "display_name": display_name,
                        "type": "eoi",
                        "source_name": eoi_name,
                        "match_name": best_match,
                        "score": round(best_score, 2),
                    })
                else:
                    orphan_eois.append({
                        "artist_id": artist_id,
                        "display_name": display_name,
                        "project_name": eoi_name,
                        "file_path": eoi.get("file_path"),
                    })

        # Orphan proposals
        for prop in proposals:
            prop_name = prop.get("project_name") or ""
            if not prop_name:
                continue
            norm_prop = _normalize(prop_name)
            if norm_prop not in project_names:
                best_score, best_match = _best_fuzzy(norm_prop, project_names)
                if best_score >= 0.7:
                    fuzzy_matches.append({
                        "artist_id": artist_id,
                        "display_name": display_name,
                        "type": "proposal",
                        "source_name": prop_name,
                        "match_name": best_match,
                        "score": round(best_score, 2),
                    })
                else:
                    orphan_proposals.append({
                        "artist_id": artist_id,
                        "display_name": display_name,
                        "project_name": prop_name,
                        "developer": prop.get("developer"),
                    })

        # Stalled projects
        for i, proj in enumerate(projects):
            status = proj.get("status", "submitted")
            if status in ("awarded",) and not proj.get("status_date"):
                stalled_projects.append({
                    "artist_id": artist_id,
                    "display_name": display_name,
                    "project_name": proj["project_name"],
                    "status": status,
                    "project_index": i,
                })

        # Panel gaps
        if panel_history and not projects:
            panel_gaps.append({
                "artist_id": artist_id,
                "display_name": display_name,
                "panel_count": len(panel_history),
            })

    return {
        "orphan_eois": orphan_eois,
        "orphan_proposals": orphan_proposals,
        "stalled_projects": stalled_projects,
        "fuzzy_matches": fuzzy_matches,
        "panel_gaps": panel_gaps,
    }


def _best_fuzzy(needle: str, haystack: set[str]) -> tuple[float, str]:
    best_score = 0.0
    best_match = ""
    for h in haystack:
        score = _similarity(needle, h)
        if score > best_score:
            best_score = score
            best_match = h
    return best_score, best_match


# ------------------------------------------------------------------
# Data quality reconciliation
# ------------------------------------------------------------------

def _data_quality_report(artists: list[tuple[str, str, dict]]) -> dict[str, list]:
    duplicate_artists = _find_duplicate_artists(artists)
    affiliation_variants = _find_affiliation_variants(artists)
    identity_inconsistencies = _find_identity_inconsistencies(artists)
    alias_conflicts = _find_alias_conflicts(artists)
    location_variants = _find_location_variants(artists)

    return {
        "duplicate_artists": duplicate_artists,
        "affiliation_variants": affiliation_variants,
        "identity_inconsistencies": identity_inconsistencies,
        "alias_conflicts": alias_conflicts,
        "location_variants": location_variants,
    }


def _find_duplicate_artists(
    artists: list[tuple[str, str, dict]],
) -> list[dict]:
    """Find artists with very similar display names."""
    results: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for i, (id_a, name_a, _) in enumerate(artists):
        if not name_a:
            continue
        for j in range(i + 1, len(artists)):
            id_b, name_b, _ = artists[j]
            if not name_b:
                continue
            pair = (min(id_a, id_b), max(id_a, id_b))
            if pair in seen:
                continue
            score = _similarity(name_a, name_b)
            if score >= 0.85 and _normalize(name_a) != _normalize(name_b):
                seen.add(pair)
                results.append({
                    "artist_id_a": id_a,
                    "name_a": name_a,
                    "artist_id_b": id_b,
                    "name_b": name_b,
                    "score": round(score, 2),
                })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:100]


def _find_affiliation_variants(
    artists: list[tuple[str, str, dict]],
) -> list[dict]:
    """Find near-match affiliation names across all artists."""
    # Collect all affiliation names → set of artist_ids using them
    aff_map: dict[str, set[str]] = defaultdict(set)
    aff_original: dict[str, str] = {}  # normalized → first original form

    for artist_id, _, m in artists:
        tags = m.get("identity", {}).get("identity_tags", {})
        for aff in tags.get("affiliations", []):
            name = aff.get("name", "")
            if not name:
                continue
            norm = _normalize(name)
            aff_map[norm].add(artist_id)
            if norm not in aff_original:
                aff_original[norm] = name

    return _find_string_variants(aff_map, aff_original, "affiliation")


def _find_identity_inconsistencies(
    artists: list[tuple[str, str, dict]],
) -> list[dict]:
    """Find near-duplicate identity tags across the corpus."""
    id_map: dict[str, set[str]] = defaultdict(set)
    id_original: dict[str, str] = {}

    for artist_id, _, m in artists:
        tags = m.get("identity", {}).get("identity_tags", {})
        for ident in tags.get("identities", []):
            if not ident:
                continue
            norm = _normalize(ident)
            id_map[norm].add(artist_id)
            if norm not in id_original:
                id_original[norm] = ident

    return _find_string_variants(id_map, id_original, "identity")


def _find_location_variants(
    artists: list[tuple[str, str, dict]],
) -> list[dict]:
    """Find near-match location place names across artists."""
    loc_map: dict[str, set[str]] = defaultdict(set)
    loc_original: dict[str, str] = {}

    for artist_id, _, m in artists:
        tags = m.get("identity", {}).get("identity_tags", {})
        for loc in tags.get("locations", []):
            place = loc.get("place", "")
            if not place:
                continue
            norm = _normalize(place)
            loc_map[norm].add(artist_id)
            if norm not in loc_original:
                loc_original[norm] = place

    return _find_string_variants(loc_map, loc_original, "location")


def _find_string_variants(
    value_map: dict[str, set[str]],
    original_map: dict[str, str],
    field_type: str,
) -> list[dict]:
    """Generic: find pairs of normalized strings that are similar but not identical."""
    results: list[dict] = []
    keys = sorted(value_map.keys())
    seen: set[tuple[str, str]] = set()

    for i, key_a in enumerate(keys):
        for j in range(i + 1, len(keys)):
            key_b = keys[j]
            if key_a == key_b:
                continue
            pair = (key_a, key_b)
            if pair in seen:
                continue
            score = _similarity(key_a, key_b)
            if score >= 0.75:
                seen.add(pair)
                results.append({
                    "type": field_type,
                    "value_a": original_map[key_a],
                    "value_b": original_map[key_b],
                    "count_a": len(value_map[key_a]),
                    "count_b": len(value_map[key_b]),
                    "score": round(score, 2),
                })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:100]


def _find_alias_conflicts(
    artists: list[tuple[str, str, dict]],
) -> list[dict]:
    """Find artists who share the same name entry (alias/pseudonym/trade name)."""
    # Map normalized name → list of (artist_id, display_name, name_type)
    name_map: dict[str, list[tuple[str, str, str, str]]] = defaultdict(list)

    for artist_id, display_name, m in artists:
        identity = m.get("identity", {})
        for name_entry in identity.get("names", []):
            name = name_entry.get("name", "")
            ntype = name_entry.get("type", "pseudonym")
            if not name:
                continue
            norm = _normalize(name)
            name_map[norm].append((artist_id, display_name, name, ntype))

    results: list[dict] = []
    for norm, entries in name_map.items():
        if len(entries) < 2:
            continue
        # Deduplicate by artist_id
        unique = {e[0]: e for e in entries}
        if len(unique) < 2:
            continue
        artists_list = [
            {"artist_id": e[0], "display_name": e[1], "name": e[2], "type": e[3]}
            for e in unique.values()
        ]
        results.append({
            "shared_name": entries[0][2],
            "artists": artists_list,
        })

    return results[:100]


# ------------------------------------------------------------------
# Resolve actions
# ------------------------------------------------------------------

def resolve_reconciliation_item(body: dict[str, Any]) -> None:
    """Execute a reconciliation action."""
    from .service import get_artist_service

    action = body.get("action")
    artist_id = body.get("artist_id", "")
    svc = get_artist_service()

    if action == "link_eoi":
        svc.add_project(artist_id, {
            "project_name": body.get("project_name", ""),
            "status": "submitted",
            "eoi_ref": body.get("eoi_name"),
        })

    elif action == "advance_status":
        project_index = body.get("project_index", -1)
        new_status = body.get("new_status", "completed")
        svc.update_project_status(artist_id, project_index, new_status)

    elif action in ("merge_affiliation", "merge_identity", "merge_location"):
        _merge_field_value(action, body)

    elif action == "dismiss":
        pass  # Frontend removes the item

    else:
        logger.warning("Unknown reconciliation action: %s", action)


def _merge_field_value(action: str, body: dict[str, Any]) -> None:
    """Standardize a field value across all artists that use the variant."""
    from .service import get_artist_service

    old_value = body.get("old_value", "")
    new_value = body.get("new_value", "")
    if not old_value or not new_value:
        return

    svc = get_artist_service()
    db = get_db()

    try:
        rows = db.execute(
            "SELECT artist_id, manifest_json FROM artists WHERE manifest_json IS NOT NULL"
        ).fetchall()
    except Exception:
        return

    norm_old = _normalize(old_value)

    for artist_id, manifest_json in rows:
        try:
            m = json.loads(manifest_json)
        except (json.JSONDecodeError, TypeError):
            continue

        tags = m.get("identity", {}).get("identity_tags", {})
        changed = False

        if action == "merge_affiliation":
            for aff in tags.get("affiliations", []):
                if _normalize(aff.get("name", "")) == norm_old:
                    aff["name"] = new_value
                    changed = True

        elif action == "merge_identity":
            identities = tags.get("identities", [])
            for i, ident in enumerate(identities):
                if _normalize(ident) == norm_old:
                    identities[i] = new_value
                    changed = True

        elif action == "merge_location":
            for loc in tags.get("locations", []):
                if _normalize(loc.get("place", "")) == norm_old:
                    loc["place"] = new_value
                    changed = True

        if changed:
            svc.save_manifest(artist_id, m)
