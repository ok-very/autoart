"""
Build orchestrator - runs PyInstaller then Inno Setup to produce the installer.

Usage:
    python scripts/build_installer.py
    python scripts/build_installer.py --skip-pyinstaller  # Only rebuild Inno Setup
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
DIST = ROOT / "dist"
SPEC_FILE = SCRIPTS / "autohelper.spec"
ISS_FILE = SCRIPTS / "installer.iss"


def run(cmd: list[str], label: str) -> None:
    """Run a command, print output, and exit on failure."""
    print(f"\n{'=' * 60}")
    print(f"  {label}")
    print(f"{'=' * 60}\n")

    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode != 0:
        print(f"\nERROR: {label} failed (exit code {result.returncode})")
        sys.exit(result.returncode)


def find_iscc() -> str | None:
    """Find Inno Setup compiler (ISCC.exe)."""
    # Common install locations
    candidates = [
        Path(r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe"),
        Path(r"C:\Program Files\Inno Setup 6\ISCC.exe"),
    ]

    # Check PATH
    iscc = shutil.which("ISCC")
    if iscc:
        return iscc

    for path in candidates:
        if path.exists():
            return str(path)

    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Build AutoHelper installer")
    parser.add_argument(
        "--skip-pyinstaller", action="store_true",
        help="Skip PyInstaller step (reuse existing dist/)",
    )
    parser.add_argument(
        "--skip-inno", action="store_true",
        help="Skip Inno Setup step (only run PyInstaller)",
    )
    args = parser.parse_args()

    # Step 1: PyInstaller
    if not args.skip_pyinstaller:
        run(
            [sys.executable, "-m", "PyInstaller", str(SPEC_FILE), "--clean", "--noconfirm"],
            "PyInstaller Build",
        )
    else:
        print("Skipping PyInstaller (--skip-pyinstaller)")

    # Verify PyInstaller output
    autohelper_exe = DIST / "autohelper" / "autohelper.exe"
    autohelper_tray = DIST / "autohelper" / "autohelper-tray.exe"

    if not autohelper_exe.exists():
        print(f"ERROR: Expected {autohelper_exe} not found")
        print("Run without --skip-pyinstaller first.")
        sys.exit(1)

    print(f"\nPyInstaller output:")
    print(f"  Console: {autohelper_exe}")
    if autohelper_tray.exists():
        print(f"  Tray:    {autohelper_tray}")

    # Step 2: Inno Setup
    if args.skip_inno:
        print("Skipping Inno Setup (--skip-inno)")
        return

    iscc = find_iscc()
    if iscc is None:
        print("\nWARNING: Inno Setup (ISCC.exe) not found.")
        print("Install from: https://jrsoftware.org/isdl.php")
        print("Skipping installer creation.")
        return

    run(
        [iscc, str(ISS_FILE)],
        "Inno Setup Installer Build",
    )

    # Find output
    for f in DIST.glob("AutoHelper-Setup-*.exe"):
        print(f"\nInstaller: {f}")
        print(f"Size: {f.stat().st_size / (1024 * 1024):.1f} MB")

    print("\nBuild complete.")


if __name__ == "__main__":
    main()
