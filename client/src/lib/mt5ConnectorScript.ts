// AUTO-EXTRACTED from MT5Bridge.tsx — keeps the wizard component lean.
// The desktop connector script lives here so it can be downloaded as a .pyw file.
export const MT5_CONNECTOR_PYTHON = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TRADIFY MT5 CONNECTOR v6.0
Professional desktop connector — double-click .pyw to run (no console)
Requires: Python 3.8+, MetaTrader 5 terminal running
"""

import subprocess
import sys
import time
import threading
import os
import tempfile

if os.name == 'nt' and os.path.basename(sys.executable).lower() != 'pythonw.exe' and not os.environ.get('TRADIFY_LAUNCHED'):
    pythonw = os.path.join(os.path.dirname(sys.executable), 'pythonw.exe')
    if os.path.exists(pythonw):
        env = os.environ.copy()
        env['TRADIFY_LAUNCHED'] = '1'
        subprocess.Popen([pythonw] + sys.argv, env=env)
        sys.exit(0)

def install_packages():
    for pkg in ['MetaTrader5', 'requests']:
        try:
            __import__(pkg if pkg == 'MetaTrader5' else pkg.lower())
        except ImportError:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', pkg, '--quiet'])

try:
    install_packages()
except Exception:
    pass

import tkinter as tk
from tkinter import scrolledtext
from datetime import datetime

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


TRADIFY_ICON_B64 = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAA40lEQVR4nO3YOw6DMAwGYG7QrCy9a4/F7TpUom0w9g9+IhJ5i2x/isyAp2n/tOXlFEzTOMQZXLyGM2VpaFOupjelU3pTumOADoHCmj3m5ycEUyTlN9araBCpYV7LF8Rrbg86oXEEiZpQEKKJA2k09iBQowWBtfQaCIQXVVIgEF7aRCOA8AZWGg6ET4N+bmQQPp62GhqUqCFAuZoelK75A1XQfEFFNFVBeANvDfpChwZfo4FA2xw/jQzaS3PSNP6z5zM9NC3mz3WAbEHl1jEDdEVQEVOtVXWtZT6tyTJxmjAc0/QNf08ZmDBpTsMAAAAASUVORK5CYII="


def create_icon_file():
    try:
        import base64
        png_data = base64.b64decode(TRADIFY_ICON_B64)
        tmp = os.path.join(tempfile.gettempdir(), "tradify_icon.png")
        with open(tmp, 'wb') as f:
            f.write(png_data)
        return tmp
    except Exception:
        return None


def create_windows_ico():
    try:
        import base64, struct
        png_data = base64.b64decode(TRADIFY_ICON_B64)
        ico_header = struct.pack('<HHH', 0, 1, 1)
        png_len = len(png_data)
        ico_entry = struct.pack('<BBBBHHII', 48, 48, 0, 0, 1, 32, png_len, 22)
        ico_data = ico_header + ico_entry + png_data
        tmp = os.path.join(tempfile.gettempdir(), "tradify_icon.ico")
        with open(tmp, 'wb') as f:
            f.write(ico_data)
        return tmp
    except Exception:
        return None


def create_desktop_shortcut():
    if os.name != 'nt':
        return False
    try:
        script_path = os.path.abspath(sys.argv[0])
        ico_path = create_windows_ico()
        if not ico_path:
            return False

        ico_permanent = os.path.join(os.path.dirname(script_path), "tradify_icon.ico")
        import shutil
        shutil.copy2(ico_path, ico_permanent)

        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        if not os.path.exists(desktop):
            desktop = os.path.join(os.environ.get("USERPROFILE", ""), "Desktop")
        if not os.path.exists(desktop):
            return False

        shortcut_path = os.path.join(desktop, "Tradify MT5 Connector.lnk")
        if os.path.exists(shortcut_path):
            return True

        pythonw = os.path.join(os.path.dirname(sys.executable), 'pythonw.exe')
        if not os.path.exists(pythonw):
            pythonw = sys.executable

        vbs = os.path.join(tempfile.gettempdir(), "tradify_shortcut.vbs")
        vbs_content = f'''Set WshShell = WScript.CreateObject("WScript.Shell")
Set shortcut = WshShell.CreateShortcut("{shortcut_path}")
shortcut.TargetPath = "{pythonw}"
shortcut.Arguments = """{script_path}"""
shortcut.WorkingDirectory = "{os.path.dirname(script_path)}"
shortcut.IconLocation = "{ico_permanent}"
shortcut.Description = "Tradify MT5 Connector"
shortcut.Save
'''
        with open(vbs, 'w') as f:
            f.write(vbs_content)
        subprocess.run(['wscript', vbs], capture_output=True, timeout=10)
        try:
            os.remove(vbs)
        except Exception:
            pass
        return os.path.exists(shortcut_path)
    except Exception:
        return False


USER_ID = "__TRADIFY_USER_ID__"
SYNC_TOKEN = "__TRADIFY_SYNC_TOKEN__"
API_URL = "__TRADIFY_API_URL__"
SYNC_INTERVAL = 10

BG = "#0c0e14"
BG2 = "#141720"
BG3 = "#1a1e2c"
BORDER = "#252a3a"
FG = "#e2e8f0"
FG2 = "#94a3b8"
FG3 = "#64748b"
GREEN = "#10b981"
RED = "#ef4444"
AMBER = "#f59e0b"


class TradifyConnector:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Tradify MT5 Connector")
        self.root.geometry("440x560")
        self.root.minsize(400, 480)
        self.root.configure(bg=BG)
        self.root.resizable(True, True)

        self._icon_photo = None
        try:
            icon_path = create_icon_file()
            if icon_path:
                self._icon_photo = tk.PhotoImage(file=icon_path)
                self.root.iconphoto(True, self._icon_photo)
        except Exception:
            pass
        try:
            if os.name == 'nt':
                ico_path = create_windows_ico()
                if ico_path:
                    self.root.iconbitmap(default=ico_path)
        except Exception:
            pass

        self.root.protocol("WM_DELETE_WINDOW", self._on_x_close)

        self.is_syncing = False
        self.sync_thread = None
        self.sync_count = 0
        self.mt5_connected = False
        self.account_info_data = None
        self.log_visible = True

        self._build_ui()
        self._check_prerequisites()

        if os.name == 'nt':
            shortcut_ok = create_desktop_shortcut()
            if shortcut_ok:
                self._log("Desktop shortcut created with Tradify icon.", "success")

    def _build_ui(self):
        outer = tk.Frame(self.root, bg=BG)
        outer.pack(fill=tk.BOTH, expand=True)

        header_bar = tk.Frame(outer, bg=BG2, height=52)
        header_bar.pack(fill=tk.X)
        header_bar.pack_propagate(False)

        hpad = tk.Frame(header_bar, bg=BG2)
        hpad.pack(fill=tk.BOTH, expand=True, padx=14)

        logo_canvas = tk.Canvas(hpad, width=28, height=28, bg=BG2, highlightthickness=0)
        logo_canvas.pack(side=tk.LEFT, pady=12)
        logo_canvas.create_rectangle(1, 1, 27, 27, fill=GREEN, outline="", width=0)
        logo_canvas.create_line(4, 18, 9, 14, 13, 19, 22, 8, fill="#0f191e", width=3, smooth=False)
        logo_canvas.create_line(19, 6, 24, 6, fill="#0f191e", width=2)
        logo_canvas.create_line(24, 6, 24, 11, fill="#0f191e", width=2)

        tk.Label(hpad, text="Tradify", font=("Segoe UI", 14, "bold"), fg=FG, bg=BG2).pack(side=tk.LEFT, padx=(8, 0))

        self.header_status_dot = tk.Canvas(hpad, width=8, height=8, bg=BG2, highlightthickness=0)
        self.header_status_dot.pack(side=tk.RIGHT, padx=(0, 2))
        self.header_status_dot.create_oval(0, 0, 8, 8, fill=RED, outline="")

        self.header_status_text = tk.Label(hpad, text="Offline", font=("Segoe UI", 8), fg=FG3, bg=BG2)
        self.header_status_text.pack(side=tk.RIGHT, padx=(0, 4))

        content = tk.Frame(outer, bg=BG)
        content.pack(fill=tk.BOTH, expand=True, padx=14, pady=10)

        status_card = tk.Frame(content, bg=BG2)
        status_card.pack(fill=tk.X, pady=(0, 8))

        status_top = tk.Frame(status_card, bg=BG2)
        status_top.pack(fill=tk.X, padx=14, pady=(12, 0))

        self.status_dot = tk.Canvas(status_top, width=12, height=12, bg=BG2, highlightthickness=0)
        self.status_dot.pack(side=tk.LEFT, padx=(0, 8))
        self.status_dot.create_oval(1, 1, 11, 11, fill=RED, outline="")

        self.status_label = tk.Label(status_top, text="DISCONNECTED", font=("Segoe UI", 12, "bold"), fg=RED, bg=BG2)
        self.status_label.pack(side=tk.LEFT)

        self.last_sync_label = tk.Label(status_top, text="", font=("Segoe UI", 8), fg=FG3, bg=BG2)
        self.last_sync_label.pack(side=tk.RIGHT)

        sep1 = tk.Frame(status_card, bg=BORDER, height=1)
        sep1.pack(fill=tk.X, padx=14, pady=(8, 0))

        metrics_frame = tk.Frame(status_card, bg=BG2)
        metrics_frame.pack(fill=tk.X, padx=14, pady=(8, 12))

        self.acct_labels = {}
        fields = [("Account", "--"), ("Broker", "--"), ("Balance", "--"), ("Equity", "--")]
        for i, (label, default) in enumerate(fields):
            r, c = divmod(i, 2)
            cell = tk.Frame(metrics_frame, bg=BG2)
            cell.grid(row=r, column=c, sticky="w", padx=(0, 24), pady=2)
            metrics_frame.columnconfigure(c, weight=1)
            tk.Label(cell, text=label.upper(), font=("Segoe UI", 7, "bold"), fg=FG3, bg=BG2).pack(anchor=tk.W)
            val = tk.Label(cell, text=default, font=("Segoe UI", 9, "bold"), fg=FG, bg=BG2)
            val.pack(anchor=tk.W, pady=(1, 0))
            self.acct_labels[label.lower()] = val

        btn_row = tk.Frame(content, bg=BG)
        btn_row.pack(fill=tk.X, pady=(2, 0))

        self.toggle_btn = tk.Button(
            btn_row, text="▶  START SYNC", font=("Segoe UI", 10, "bold"),
            fg="#ffffff", bg=GREEN, activebackground="#059669", activeforeground="#ffffff",
            relief=tk.FLAT, cursor="hand2", command=self._toggle_sync, pady=9
        )
        self.toggle_btn.pack(fill=tk.X)

        log_section = tk.Frame(content, bg=BG)
        log_section.pack(fill=tk.BOTH, expand=True, pady=(8, 0))

        log_header = tk.Frame(log_section, bg=BG)
        log_header.pack(fill=tk.X, pady=(0, 3))

        self.log_toggle_btn = tk.Button(
            log_header, text="▼ ACTIVITY LOG", font=("Segoe UI", 7, "bold"),
            fg=FG3, bg=BG, activebackground=BG, activeforeground=FG2,
            relief=tk.FLAT, cursor="hand2", command=self._toggle_log, bd=0
        )
        self.log_toggle_btn.pack(side=tk.LEFT)

        self.sync_count_label = tk.Label(log_header, text="0 syncs", font=("Segoe UI", 7), fg=FG3, bg=BG)
        self.sync_count_label.pack(side=tk.RIGHT)

        self.log_frame = tk.Frame(log_section, bg=BG)

        self.log_area = scrolledtext.ScrolledText(
            self.log_frame, height=7, font=("Consolas", 8),
            bg=BG3, fg=FG2, insertbackground=FG,
            selectbackground="#1e40af", relief=tk.FLAT,
            borderwidth=0, wrap=tk.WORD, padx=8, pady=6
        )
        self.log_area.pack(fill=tk.BOTH, expand=True)
        self.log_area.configure(state=tk.DISABLED)

        self.log_area.tag_config("success", foreground=GREEN)
        self.log_area.tag_config("error", foreground=RED)
        self.log_area.tag_config("warn", foreground=AMBER)
        self.log_area.tag_config("info", foreground=FG3)

        self.log_frame.pack(fill=tk.BOTH, expand=True)

        footer = tk.Frame(outer, bg=BG2, height=32)
        footer.pack(fill=tk.X, side=tk.BOTTOM)
        footer.pack_propagate(False)

        tk.Label(footer, text="v6.0", font=("Segoe UI", 7), fg=FG3, bg=BG2).pack(side=tk.LEFT, padx=12)

        quit_btn = tk.Button(
            footer, text="✕ DISCONNECT & QUIT", font=("Segoe UI", 7, "bold"),
            fg="#ef4444", bg=BG2, activebackground=BG2, activeforeground="#dc2626",
            relief=tk.FLAT, cursor="hand2", command=self._on_close, bd=0
        )
        quit_btn.pack(side=tk.RIGHT, padx=12)

        self.footer_status = tk.Label(footer, text="Ready", font=("Segoe UI", 7), fg=FG3, bg=BG2)
        self.footer_status.pack(side=tk.RIGHT, padx=(0, 8))

    def _toggle_log(self):
        if self.log_visible:
            self.log_frame.pack_forget()
            self.log_toggle_btn.configure(text="▶ ACTIVITY LOG")
            self.log_visible = False
        else:
            self.log_frame.pack(fill=tk.BOTH, expand=True)
            self.log_toggle_btn.configure(text="▼ ACTIVITY LOG")
            self.log_visible = True

    def _on_x_close(self):
        if self.is_syncing:
            self.root.iconify()
            self._log("Minimized to taskbar — sync continues running.", "info")
        else:
            self._on_close()

    def _log(self, message, tag="info"):
        ts = datetime.now().strftime("%H:%M:%S")
        self.log_area.configure(state=tk.NORMAL)
        self.log_area.insert(tk.END, f"[{ts}] {message}\\\\n", tag)
        self.log_area.see(tk.END)

        lines = int(self.log_area.index('end-1c').split('.')[0])
        if lines > 200:
            self.log_area.delete('1.0', f'{lines - 200}.0')

        self.log_area.configure(state=tk.DISABLED)
        try:
            self.footer_status.configure(text=message[:50])
        except Exception:
            pass

    def _set_status(self, connected, text=None):
        self.mt5_connected = connected
        color = GREEN if connected else RED
        label = text or ("CONNECTED" if connected else "DISCONNECTED")
        self.status_dot.delete("all")
        self.status_dot.create_oval(1, 1, 11, 11, fill=color, outline="")
        self.status_label.configure(text=label, fg=color)
        h_text = "Online" if connected else "Offline"
        if text and text not in ("CONNECTED", "DISCONNECTED"):
            h_text = text
        self.header_status_dot.delete("all")
        self.header_status_dot.create_oval(0, 0, 8, 8, fill=color, outline="")
        self.header_status_text.configure(text=h_text, fg=color if connected else FG3)

    def _update_account(self, info):
        if info:
            self.acct_labels["account"].configure(text=str(info.login))
            self.acct_labels["broker"].configure(text=str(info.company)[:24])
            self.acct_labels["balance"].configure(text=f"{info.balance:,.2f} {info.currency}")
            self.acct_labels["equity"].configure(text=f"{info.equity:,.2f} {info.currency}")
        else:
            for key in self.acct_labels:
                self.acct_labels[key].configure(text="--")

    def _check_prerequisites(self):
        if not USER_ID or not SYNC_TOKEN:
            self._log("Missing credentials! Download a fresh connector from Tradify.", "error")
            self.toggle_btn.configure(state=tk.DISABLED, bg="#374151")
            return

        if not MT5_AVAILABLE:
            self._log("MetaTrader5 package not found. Install: pip install MetaTrader5", "error")
            self.toggle_btn.configure(state=tk.DISABLED, bg="#374151")
            return

        if not REQUESTS_AVAILABLE:
            self._log("Requests package not found. Install: pip install requests", "error")
            self.toggle_btn.configure(state=tk.DISABLED, bg="#374151")
            return

        self._log("Ready to connect.", "success")

    def _toggle_sync(self):
        if self.is_syncing:
            self.is_syncing = False
            self.toggle_btn.configure(text="▶  START SYNC", bg=GREEN, activebackground="#059669")
            self._log("Sync stopped by user.", "warn")
            self._set_status(False, "STOPPED")
        else:
            self.is_syncing = True
            self.toggle_btn.configure(text="■  STOP SYNC", bg=RED, activebackground="#dc2626")
            self._log("Starting sync...", "info")
            self.sync_thread = threading.Thread(target=self._sync_loop, daemon=True)
            self.sync_thread.start()

    def _sync_loop(self):
        self.root.after(0, lambda: self._set_status(False, "CONNECTING..."))

        if not mt5.initialize():
            err = mt5.last_error()
            self.root.after(0, lambda: self._log(f"MT5 init failed: {err}", "error"))
            self.root.after(0, lambda: self._log("Ensure MT5 is open and logged in.", "warn"))
            self.root.after(0, lambda: self._set_status(False))
            self.is_syncing = False
            self.root.after(0, lambda: self.toggle_btn.configure(
                text="▶  START SYNC", bg=GREEN, activebackground="#059669"
            ))
            return

        acct = mt5.account_info()
        if acct is None:
            self.root.after(0, lambda: self._log("Cannot read account. Is MT5 logged in?", "error"))
            self.root.after(0, lambda: self._set_status(False))
            mt5.shutdown()
            self.is_syncing = False
            self.root.after(0, lambda: self.toggle_btn.configure(
                text="▶  START SYNC", bg=GREEN, activebackground="#059669"
            ))
            return

        self.root.after(0, lambda: self._update_account(acct))
        self.root.after(0, lambda: self._set_status(True))
        self.root.after(0, lambda: self._log(f"Connected to MT5 account {acct.login}", "success"))

        from datetime import datetime as dt_cls
        epoch_start = int(dt_cls(2000, 1, 1).timestamp())
        try:
            mt5.history_orders_get(epoch_start, int(time.time()) + 86400)
            mt5.history_deals_get(epoch_start, int(time.time()) + 86400)
        except Exception:
            pass

        while self.is_syncing:
            try:
                account_info = mt5.account_info()
                if account_info is None:
                    self.root.after(0, lambda: self._log("Lost MT5 connection, retrying...", "warn"))
                    self.root.after(0, lambda: self._set_status(False, "RECONNECTING..."))
                    time.sleep(10)
                    if not mt5.initialize():
                        continue
                    account_info = mt5.account_info()
                    if account_info is None:
                        continue
                    self.root.after(0, lambda: self._set_status(True))
                    self.root.after(0, lambda: self._log("Reconnected to MT5", "success"))

                self.root.after(0, lambda ai=account_info: self._update_account(ai))

                positions = mt5.positions_get()
                pos_list = []
                if positions:
                    for p in positions:
                        pos_list.append({
                            "ticket": p.ticket, "symbol": p.symbol,
                            "type": "Buy" if p.type == 0 else "Sell",
                            "volume": p.volume, "price": p.price_open,
                            "profit": p.profit, "sl": p.sl, "tp": p.tp
                        })

                now_ts = int(time.time()) + 86400
                history = mt5.history_deals_get(epoch_start, now_ts)
                hist_list = []
                if history:
                    open_deals = {}
                    for d in history:
                        if d.entry == 0 and d.position_id > 0:
                            open_deals[d.position_id] = d
                    for d in history:
                        if d.entry in (1, 2, 3):
                            opener = open_deals.get(d.position_id)
                            hist_list.append({
                                "ticket": d.ticket, "symbol": d.symbol,
                                "type": d.type, "volume": d.volume,
                                "open_price": opener.price if opener else d.price,
                                "close_price": d.price, "profit": d.profit,
                                "commission": d.commission, "swap": d.swap,
                                "open_time": opener.time if opener else d.time,
                                "close_time": d.time
                            })

                payload = {
                    "userId": USER_ID, "token": SYNC_TOKEN,
                    "accountNumber": str(account_info.login),
                    "balance": float(account_info.balance),
                    "equity": float(account_info.equity),
                    "margin": float(account_info.margin),
                    "freeMargin": float(account_info.margin_free),
                    "marginLevel": float(account_info.margin_level),
                    "floatingPl": float(account_info.profit),
                    "leverage": int(account_info.leverage),
                    "currency": account_info.currency,
                    "positions": pos_list, "history": hist_list
                }

                resp = requests.post(API_URL, json=payload, timeout=60)

                if resp.status_code == 200:
                    self.sync_count += 1
                    try:
                        srv = resp.json()
                        srv_count = srv.get("serverTradeCount", "?")
                    except Exception:
                        srv_count = "?"
                    eq_val = account_info.equity
                    pos_count = len(pos_list)
                    trade_count = len(hist_list)
                    sc = self.sync_count
                    self.root.after(0, lambda e=eq_val, t=trade_count, p=pos_count, s=srv_count, c=sc: (
                        self._log(f"Synced | Equity: {e:.2f} | Trades: {t} (server: {s}) | Positions: {p}", "success"),
                        self.sync_count_label.configure(text=f"{c} syncs"),
                        self.last_sync_label.configure(text=f"Last sync: {datetime.now().strftime('%H:%M:%S')}")
                    ))
                elif resp.status_code == 403:
                    self.root.after(0, lambda: self._log("Auth error: Invalid or expired token.", "error"))
                    self.root.after(0, lambda: self._log("Generate a new token from the MT5 Bridge page.", "warn"))
                    break
                else:
                    code = resp.status_code
                    self.root.after(0, lambda c=code: self._log(f"Sync failed (HTTP {c})", "error"))

            except requests.exceptions.RequestException as e:
                err_msg = str(e)
                self.root.after(0, lambda m=err_msg: self._log(f"Network error: {m}", "error"))
            except Exception as e:
                err_msg = str(e)
                self.root.after(0, lambda m=err_msg: self._log(f"Error: {m}", "error"))

            time.sleep(SYNC_INTERVAL)

        try:
            mt5.shutdown()
        except Exception:
            pass
        self.root.after(0, lambda: self._set_status(False))

    def _on_close(self):
        if self.is_syncing:
            self.is_syncing = False
            if self.sync_thread and self.sync_thread.is_alive():
                self.sync_thread.join(timeout=3)
        try:
            if MT5_AVAILABLE:
                mt5.shutdown()
        except Exception:
            pass
        try:
            self.root.destroy()
        except Exception:
            pass
        os._exit(0)

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    if sys.version_info < (3, 8):
        try:
            import tkinter.messagebox
            tkinter.messagebox.showerror(
                "Tradify Connector",
                f"Python 3.8+ required.\\\\nYou have Python {sys.version}"
            )
        except Exception:
            print(f"Python 3.8+ required. You have {sys.version}")
        sys.exit(1)
    app = TradifyConnector()
    app.run()`;
