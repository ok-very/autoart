"""
General-purpose domain pass.

A single class that handles any category (indigenous, public, private, corporate)
using layout config from the lexicon.  Replaces IndigenousPass and StubPass.
"""
from __future__ import annotations

import logging
import os
import threading
from collections.abc import Callable
from pathlib import Path
from typing import Any

from ..config import DEFAULT_DOMAIN_CONFIGS, DomainConfig, get_lexicon
from ..scanner import scan_artist_folder

logger = logging.getLogger(__name__)


class GeneralPass:
    """Scans one category directory using its configured layout."""

    def __init__(self, category_key: str) -> None:
        self._category_key = category_key

    @property
    def domain_key(self) -> str:
        return self._category_key

    @property
    def label(self) -> str:
        lex = get_lexicon()
        cat = next((c for c in lex.categories if c.key == self._category_key), None)
        return cat.label if cat else self._category_key

    def _get_domain_config(self) -> DomainConfig:
        lex = get_lexicon()
        return lex.domain_configs.get(
            self._category_key,
            DEFAULT_DOMAIN_CONFIGS.get(
                self._category_key,
                DomainConfig(key=self._category_key),
            ),
        )

    def execute(
        self,
        storage_root: Path,
        progress_cb: Callable[[str], None],
        cancel: threading.Event | None = None,
    ) -> list[dict[str, Any]]:
        lex = get_lexicon()
        cat = next((c for c in lex.categories if c.key == self._category_key), None)
        if not cat:
            return []

        domain_cfg = self._get_domain_config()
        cat_path = storage_root / cat.rel_path
        if not cat_path.is_dir():
            progress_cb(f"[{cat.label}] Path not found: {cat_path}")
            return []

        progress_cb(f"[{cat.label}] Scanning {cat_path}")

        if cat.layout == "nation_based":
            records = self._scan_nation_based(cat_path, cat.key, progress_cb, cancel)
        elif cat.layout == "bucketed":
            records = self._scan_bucketed(cat_path, cat.key, progress_cb, cancel)
        elif cat.layout == "flat":
            records = self._scan_flat(cat_path, cat.key, progress_cb, cancel)
        else:
            progress_cb(f"[{cat.label}] Unknown layout: {cat.layout}")
            return []

        progress_cb(f"[{cat.label}] {len(records)} folders")

        # Stamp domain metadata
        for rec in records:
            rec["domain_source"] = self._category_key
            rec["confidence"] = domain_cfg.confidence
            rec["validation_flags"] = []
            rec["ground_truth_match"] = None
            rec["contact_enrichment"] = {}

        return records

    # ------------------------------------------------------------------
    # Layout walkers
    # ------------------------------------------------------------------

    def _scan_nation_based(
        self,
        cat_path: Path,
        category: str,
        emit: Callable[[str], None],
        cancel: threading.Event | None,
    ) -> list[dict[str, Any]]:
        """Walk <Nation>/<ArtistFolder>/ structure."""
        lex = get_lexicon()
        domain_cfg = self._get_domain_config()
        extra_ignore = set(domain_cfg.extra_ignore_dirs)
        records: list[dict[str, Any]] = []

        try:
            nations = sorted(os.listdir(cat_path))
        except PermissionError:
            return records

        for nation in nations:
            if cancel and cancel.is_set():
                break
            nation_path = os.path.join(cat_path, nation)
            if not os.path.isdir(nation_path):
                continue
            if nation.lower() in lex.ignore_dirs or nation.lower() in extra_ignore:
                continue

            emit(f"  [{category}] {nation}")

            try:
                artist_folders = sorted(os.listdir(nation_path))
            except PermissionError:
                continue

            for folder in artist_folders:
                artist_path = os.path.join(nation_path, folder)
                if not os.path.isdir(artist_path) or folder.lower() in lex.ignore_dirs:
                    continue
                records.append(scan_artist_folder(
                    category=category,
                    nation=nation,
                    folder_name=folder,
                    folder_path=artist_path,
                ))

        return records

    def _scan_bucketed(
        self,
        cat_path: Path,
        category: str,
        emit: Callable[[str], None],
        cancel: threading.Event | None,
    ) -> list[dict[str, Any]]:
        """Walk <LetterBucket>/<ArtistFolder>/ structure (e.g. PRIVATE ART)."""
        lex = get_lexicon()
        domain_cfg = self._get_domain_config()
        extra_ignore = set(domain_cfg.extra_ignore_dirs)
        records: list[dict[str, Any]] = []

        try:
            buckets = sorted(os.listdir(cat_path))
        except PermissionError:
            return records

        for bucket in buckets:
            if cancel and cancel.is_set():
                break
            if bucket.startswith("z_") or bucket.lower() in lex.ignore_dirs or bucket.lower() in extra_ignore:
                continue
            bucket_path = os.path.join(cat_path, bucket)
            if not os.path.isdir(bucket_path):
                continue

            emit(f"  [{category}] {bucket}")

            try:
                artist_folders = sorted(os.listdir(bucket_path))
            except PermissionError:
                continue

            for folder in artist_folders:
                if folder.startswith("a ") or folder.startswith("z_"):
                    continue
                artist_path = os.path.join(bucket_path, folder)
                if not os.path.isdir(artist_path):
                    continue
                records.append(scan_artist_folder(
                    category=category,
                    nation=None,
                    folder_name=folder,
                    folder_path=artist_path,
                ))

        return records

    def _scan_flat(
        self,
        cat_path: Path,
        category: str,
        emit: Callable[[str], None],
        cancel: threading.Event | None,
    ) -> list[dict[str, Any]]:
        """Walk flat <ArtistFolder>/ structure (e.g. CORPORATE ART)."""
        lex = get_lexicon()
        domain_cfg = self._get_domain_config()
        extra_ignore = set(domain_cfg.extra_ignore_dirs)
        records: list[dict[str, Any]] = []

        try:
            artist_folders = sorted(os.listdir(cat_path))
        except PermissionError:
            return records

        for folder in artist_folders:
            if cancel and cancel.is_set():
                break
            if folder.lower() in lex.ignore_dirs or folder.lower() in extra_ignore or folder.startswith("z_"):
                continue
            artist_path = os.path.join(cat_path, folder)
            if not os.path.isdir(artist_path):
                continue
            records.append(scan_artist_folder(
                category=category,
                nation=None,
                folder_name=folder,
                folder_path=artist_path,
            ))

        return records
