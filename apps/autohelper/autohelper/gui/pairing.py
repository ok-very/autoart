"""
Standalone tkinter dialog for entering a 6-digit pairing code.

Called from the pystray menu callback thread, which keeps the tray
responsive while the dialog blocks.

Falls back to opening the browser settings page if tkinter is
unavailable (headless Linux, minimal containers).
"""

from autohelper.shared.logging import get_logger

logger = get_logger(__name__)


def ask_pairing_code() -> str | None:
    """Show a modal dialog for the 6-digit pairing code.

    Returns the code string on submit, None on cancel/close.
    Falls back to opening browser settings if tkinter is missing.
    """
    try:
        import tkinter as tk
    except ModuleNotFoundError:
        logger.warning("tkinter not available — opening browser settings instead")
        from autohelper.gui.popup import open_settings_in_browser

        open_settings_in_browser()
        return None

    code: str | None = None

    root = tk.Tk()
    root.title("Pair with AutoArt")
    root.resizable(False, False)
    root.attributes("-topmost", True)

    # Center on screen
    w, h = 320, 150
    x = (root.winfo_screenwidth() - w) // 2
    y = (root.winfo_screenheight() - h) // 2
    root.geometry(f"{w}x{h}+{x}+{y}")

    tk.Label(root, text="Enter 6-digit code from AutoArt", pady=12).pack()

    # Validation: digits only, max 6 chars
    vcmd = (root.register(lambda s: s.isdigit() and len(s) <= 6 or s == ""), "%P")
    entry_var = tk.StringVar()
    entry = tk.Entry(
        root,
        textvariable=entry_var,
        font=("monospace", 18),
        justify="center",
        validate="key",
        validatecommand=vcmd,
        width=8,
    )
    entry.pack(pady=(0, 12))
    entry.focus_set()

    btn_frame = tk.Frame(root)
    btn_frame.pack()

    pair_btn = tk.Button(
        btn_frame,
        text="Pair",
        width=10,
        state="disabled",
        command=lambda: _submit(),
    )
    pair_btn.pack(side="left", padx=4)

    cancel_btn = tk.Button(
        btn_frame,
        text="Cancel",
        width=10,
        command=root.destroy,
    )
    cancel_btn.pack(side="left", padx=4)

    def _on_change(*_: object) -> None:
        state = "normal" if len(entry_var.get()) == 6 else "disabled"
        pair_btn.configure(state=state)

    entry_var.trace_add("write", _on_change)

    def _submit() -> None:
        nonlocal code
        code = entry_var.get()
        root.destroy()

    # Enter key submits when 6 digits present
    root.bind("<Return>", lambda _: _submit() if len(entry_var.get()) == 6 else None)

    root.mainloop()
    return code
