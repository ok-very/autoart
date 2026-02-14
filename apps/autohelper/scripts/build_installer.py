"""
Build orchestrator - runs PyInstaller then packages as MSIX.

Usage:
    python scripts/build_installer.py
    python scripts/build_installer.py --skip-pyinstaller   # Reuse existing dist/
    python scripts/build_installer.py --skip-sign           # Skip code signing
    python scripts/build_installer.py --pfx cert.pfx --pfx-password pass  # Sign with cert
"""

from __future__ import annotations

import argparse
import glob
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
MSIX_DIR = SCRIPTS / "msix"
DIST = ROOT / "dist"
SPEC_FILE = SCRIPTS / "autohelper.spec"
MANIFEST_TEMPLATE = MSIX_DIR / "AppxManifest.xml"

DEFAULT_VERSION = "0.1.0"
GITHUB_REPO = "ok-very/autoart"


def run(cmd: list[str], label: str, cwd: Path | None = None) -> None:
    """Run a command, print output, and exit on failure."""
    print(f"\n{'=' * 60}")
    print(f"  {label}")
    print(f"{'=' * 60}\n")

    result = subprocess.run(cmd, cwd=str(cwd or ROOT))
    if result.returncode != 0:
        print(f"\nERROR: {label} failed (exit code {result.returncode})")
        sys.exit(result.returncode)


def find_sdk_tool(name: str) -> Path | None:
    """Find a Windows SDK tool (MakeAppx.exe, signtool.exe)."""
    # Check PATH first
    found = shutil.which(name)
    if found:
        return Path(found)

    # Search Windows SDK bins (pick highest version)
    sdk_pattern = r"C:\Program Files (x86)\Windows Kits\10\bin\10.*\x64"
    candidates = sorted(glob.glob(sdk_pattern), reverse=True)
    for sdk_bin in candidates:
        tool = Path(sdk_bin) / name
        if tool.exists():
            return tool

    return None


def get_version() -> str:
    """Read version from __init__.py."""
    init_file = ROOT / "autohelper" / "__init__.py"
    if init_file.exists():
        content = init_file.read_text()
        match = re.search(r'__version__\s*=\s*"(.+?)"', content)
        if match:
            return match.group(1)
    return DEFAULT_VERSION


def step_pyinstaller(skip: bool) -> None:
    """Step 1: Run PyInstaller."""
    if skip:
        print("Skipping PyInstaller (--skip-pyinstaller)")
        return

    run(
        [sys.executable, "-m", "PyInstaller", str(SPEC_FILE), "--clean", "--noconfirm"],
        "PyInstaller Build",
    )


def verify_pyinstaller_output() -> None:
    """Verify PyInstaller produced the expected executables."""
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


def step_layout(version: str) -> Path:
    """Step 2: Create MSIX layout directory."""
    layout = DIST / "msix_layout"

    # Clean previous layout
    if layout.exists():
        shutil.rmtree(layout)

    print(f"\n{'=' * 60}")
    print(f"  Creating MSIX layout")
    print(f"{'=' * 60}\n")

    # Copy PyInstaller output
    src = DIST / "autohelper"
    shutil.copytree(src, layout)
    print(f"  Copied {src} -> {layout}")

    # Copy env.template
    env_template = ROOT / "env.template"
    if env_template.exists():
        shutil.copy2(env_template, layout / ".env.template")
        print(f"  Copied env.template")

    # Inject version into manifest and write to layout
    manifest_text = MANIFEST_TEMPLATE.read_text(encoding="utf-8")
    manifest_text = manifest_text.replace(
        'Version="0.0.0.0"',
        f'Version="{version}.0"',
    )
    (layout / "AppxManifest.xml").write_text(manifest_text, encoding="utf-8")
    print(f"  Wrote AppxManifest.xml (version {version}.0)")

    # Generate/copy logo assets
    assets_dir = layout / "Assets"
    assets_dir.mkdir(exist_ok=True)

    # Try generating with Pillow, fall back to minimal valid PNGs
    try:
        _generate_assets_pillow(assets_dir)
    except Exception:
        _generate_assets_minimal(assets_dir)

    return layout


def _generate_assets_pillow(assets_dir: Path) -> None:
    """Generate assets using the Pillow-based script."""
    run(
        [sys.executable, str(MSIX_DIR / "generate_assets.py"), str(assets_dir)],
        "Generate Logo Assets (Pillow)",
    )


def _generate_assets_minimal(assets_dir: Path) -> None:
    """Create minimal valid 1x1 PNGs as fallback when Pillow isn't available."""
    print("  Pillow not available, generating minimal placeholder PNGs")

    # Minimal valid PNG: 1x1 pixel, RGBA, oxide blue
    # This is a valid PNG file — MakeAppx accepts it.
    import struct
    import zlib

    def make_png(width: int, height: int) -> bytes:
        """Create a minimal solid-color PNG."""

        def chunk(chunk_type: bytes, data: bytes) -> bytes:
            c = chunk_type + data
            return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

        header = b"\x89PNG\r\n\x1a\n"
        ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        # RGB row: filter byte + pixel data
        raw = b""
        for _ in range(height):
            raw += b"\x00" + b"\x3f\x5c\x6e" * width  # Oxide Blue
        idat = chunk(b"IDAT", zlib.compress(raw))
        iend = chunk(b"IEND", b"")
        return header + ihdr + idat + iend

    assets = [
        ("Square44x44Logo.png", 44, 44),
        ("Square150x150Logo.png", 150, 150),
        ("Wide310x150Logo.png", 310, 150),
        ("StoreLogo.png", 50, 50),
    ]
    for name, w, h in assets:
        (assets_dir / name).write_bytes(make_png(w, h))
        print(f"    {name} ({w}x{h})")


def step_pack(layout: Path, version: str) -> Path:
    """Step 3: Pack MSIX with MakeAppx.exe."""
    makeappx = find_sdk_tool("MakeAppx.exe")
    if makeappx is None:
        print("ERROR: MakeAppx.exe not found.")
        print("Install the Windows 10 SDK or run on a windows-latest CI runner.")
        sys.exit(1)

    msix_path = DIST / f"AutoHelper-{version}.msix"

    # Remove previous package
    if msix_path.exists():
        msix_path.unlink()

    run(
        [str(makeappx), "pack", "/d", str(layout), "/p", str(msix_path), "/o"],
        "MakeAppx Pack",
    )

    if not msix_path.exists():
        print(f"ERROR: Expected {msix_path} not produced")
        sys.exit(1)

    print(f"\n  MSIX: {msix_path}")
    print(f"  Size: {msix_path.stat().st_size / (1024 * 1024):.1f} MB")
    return msix_path


def step_sign(msix_path: Path, pfx: str, pfx_password: str) -> None:
    """Step 4: Sign MSIX with signtool.exe."""
    signtool = find_sdk_tool("signtool.exe")
    if signtool is None:
        print("ERROR: signtool.exe not found.")
        print("Install the Windows 10 SDK or run on a windows-latest CI runner.")
        sys.exit(1)

    run(
        [
            str(signtool), "sign",
            "/fd", "SHA256",
            "/a",
            "/f", pfx,
            "/p", pfx_password,
            str(msix_path),
        ],
        "Sign MSIX",
    )


def step_appinstaller(version: str) -> Path:
    """Step 5: Generate .appinstaller for auto-updates."""
    content = f"""\
<?xml version="1.0" encoding="utf-8"?>
<AppInstaller
  xmlns="http://schemas.microsoft.com/appx/appinstaller/2018"
  Uri="https://github.com/{GITHUB_REPO}/releases/latest/download/AutoHelper.appinstaller"
  Version="{version}.0">

  <MainPackage
    Name="OkVery.AutoHelper"
    Publisher="CN=ok-very"
    Version="{version}.0"
    ProcessorArchitecture="x64"
    Uri="https://github.com/{GITHUB_REPO}/releases/latest/download/AutoHelper-{version}.msix" />

  <UpdateSettings>
    <OnLaunch HoursBetweenUpdateChecks="24" />
  </UpdateSettings>
</AppInstaller>
"""
    out = DIST / "AutoHelper.appinstaller"
    out.write_text(content, encoding="utf-8")
    print(f"\n  AppInstaller: {out}")
    return out


def step_cleanup(layout: Path) -> None:
    """Step 6: Remove layout directory."""
    if layout.exists():
        shutil.rmtree(layout)
        print(f"  Cleaned up {layout}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build AutoHelper MSIX package")
    parser.add_argument(
        "--skip-pyinstaller", action="store_true",
        help="Skip PyInstaller step (reuse existing dist/)",
    )
    parser.add_argument(
        "--skip-sign", action="store_true",
        help="Skip code signing (for local dev builds)",
    )
    parser.add_argument(
        "--pfx", type=str, default=None,
        help="Path to PFX certificate file for signing",
    )
    parser.add_argument(
        "--pfx-password", type=str, default=None,
        help="Password for PFX certificate",
    )
    parser.add_argument(
        "--version", type=str, default=None,
        help="Override version (default: read from __init__.py)",
    )
    args = parser.parse_args()

    version = args.version or get_version()
    print(f"Building AutoHelper MSIX v{version}")

    # Validate signing args
    if not args.skip_sign:
        if not args.pfx or not args.pfx_password:
            print("ERROR: --pfx and --pfx-password required unless --skip-sign is set")
            sys.exit(1)

    # Step 1: PyInstaller
    step_pyinstaller(args.skip_pyinstaller)
    verify_pyinstaller_output()

    # Step 2: Layout
    layout = step_layout(version)

    # Step 3: Pack
    msix_path = step_pack(layout, version)

    # Step 4: Sign
    if not args.skip_sign:
        step_sign(msix_path, args.pfx, args.pfx_password)
    else:
        print("\nSkipping signing (--skip-sign)")

    # Step 5: AppInstaller
    step_appinstaller(version)

    # Step 6: Cleanup
    step_cleanup(layout)

    print(f"\n{'=' * 60}")
    print(f"  Build complete")
    print(f"{'=' * 60}")
    print(f"\n  dist/AutoHelper-{version}.msix")
    print(f"  dist/AutoHelper.appinstaller")


if __name__ == "__main__":
    main()
