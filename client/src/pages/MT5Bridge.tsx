import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Activity, 
  Wallet, 
  BarChart3, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck,
  Terminal,
  Copy,
  Check,
  Cpu,
  Download,
  Key,
  Server,
  Play,
  Monitor,
  Wifi,
  WifiOff,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  TrendingUp,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MT5Bridge() {
  const [copied, setCopied] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useQuery<any>({ 
    queryKey: ["/api/user"],
    staleTime: 0,
  });
  
  const currentUserId = user?.userId;

  const { data: userRoleData } = useQuery<any>({
    queryKey: [`/api/traders-hub/user-role/${currentUserId}`],
    enabled: !!currentUserId,
  });


  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/traders-hub/generate-token", { userId: currentUserId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: [`/api/traders-hub/user-role/${currentUserId}`] });
      toast({
        title: "Token Generated",
        description: "Your one-time sync token has been generated.",
      });
    },
  });

  const { data: mt5, refetch } = useQuery<{
    status: string;
    metrics?: {
      balance: string;
      equity: string;
      floatingPl: string;
      marginLevel: string;
      margin: string;
      freeMargin: string;
      positions: Array<{
        symbol: string;
        type: string;
        volume: number;
        price: number;
        profit: number;
        ticket: number;
      }>;
    };
  }>({
    queryKey: [`/api/mt5/status/${currentUserId}`],
    refetchInterval: 5000,
    staleTime: 0,
    enabled: !!currentUserId,
  });

  const isConnected = mt5?.status === "CONNECTED";

  const pythonCode = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TRADIFY MT5 CONNECTOR v5.0
Professional desktop connector — double-click .pyw to run (no console)
Requires: Python 3.8+, MetaTrader 5 terminal running
"""

import subprocess
import sys
import time
import threading
import os

def install_packages():
    required = ['MetaTrader5', 'requests', 'pystray', 'Pillow']
    for pkg in required:
        mod = pkg.replace('-', '_').lower()
        if pkg == 'MetaTrader5':
            mod = 'MetaTrader5'
        elif pkg == 'Pillow':
            mod = 'PIL'
        elif pkg == 'pystray':
            mod = 'pystray'
        try:
            __import__(mod)
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

HAS_TRAY = False
try:
    import pystray
    from PIL import Image, ImageDraw, ImageFont, ImageTk
    HAS_TRAY = True
except ImportError:
    pass


def make_icon_image(size=64):
    try:
        from PIL import Image, ImageDraw
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle([0, 0, size-1, size-1], radius=size//5, fill=(16, 185, 129, 255))
        try:
            from PIL import ImageFont
            font = ImageFont.truetype("segoeui.ttf", size//2)
        except Exception:
            try:
                from PIL import ImageFont
                font = ImageFont.truetype("arial.ttf", size//2)
            except Exception:
                font = None
        if font:
            draw.text((size//2, size//2), "T", fill=(255, 255, 255, 255), font=font, anchor="mm")
        else:
            cx, cy, fs = size//2, size//2, size//3
            draw.text((cx - fs//3, cy - fs//2), "T", fill=(255, 255, 255, 255))
        return img
    except Exception:
        return None


USER_ID = "${currentUserId || ""}"
SYNC_TOKEN = "${userRoleData?.syncToken || ""}"
API_URL = "${window.location.protocol}//${window.location.host}/api/mt5/sync"
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
BLUE = "#3b82f6"


class TradifyConnector:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Tradify")
        self.root.geometry("440x560")
        self.root.minsize(400, 480)
        self.root.configure(bg=BG)
        self.root.resizable(True, True)

        try:
            icon_img = make_icon_image(64)
            if icon_img:
                self._icon_photo = ImageTk.PhotoImage(icon_img)
                self.root.iconphoto(True, self._icon_photo)
        except Exception:
            pass

        self.root.protocol("WM_DELETE_WINDOW", self._on_minimize_to_tray)

        self.is_syncing = False
        self.sync_thread = None
        self.sync_count = 0
        self.mt5_connected = False
        self.account_info_data = None
        self.tray_icon = None
        self.log_visible = False

        self._build_ui()
        self._check_prerequisites()
        self._setup_tray()

    def _build_ui(self):
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        outer = tk.Frame(self.root, bg=BG)
        outer.pack(fill=tk.BOTH, expand=True)
        outer.columnconfigure(0, weight=1)

        header_bar = tk.Frame(outer, bg=BG2, height=56)
        header_bar.pack(fill=tk.X)
        header_bar.pack_propagate(False)

        hpad = tk.Frame(header_bar, bg=BG2)
        hpad.pack(fill=tk.BOTH, expand=True, padx=16)

        logo_canvas = tk.Canvas(hpad, width=32, height=32, bg=BG2, highlightthickness=0)
        logo_canvas.pack(side=tk.LEFT, pady=12)
        logo_canvas.create_rectangle(2, 2, 30, 30, fill=GREEN, outline="", width=0)
        logo_canvas.create_text(16, 16, text="T", fill="white", font=("Segoe UI", 14, "bold"))

        tk.Label(hpad, text="Tradify", font=("Segoe UI", 15, "bold"), fg=FG, bg=BG2).pack(side=tk.LEFT, padx=(8, 0))
        tk.Label(hpad, text="MT5 Connector", font=("Segoe UI", 10), fg=FG3, bg=BG2).pack(side=tk.LEFT, padx=(6, 0), pady=(2, 0))

        self.header_status_dot = tk.Canvas(hpad, width=10, height=10, bg=BG2, highlightthickness=0)
        self.header_status_dot.pack(side=tk.RIGHT, padx=(0, 4), pady=0)
        self.header_status_dot.create_oval(1, 1, 9, 9, fill=RED, outline="")

        self.header_status_text = tk.Label(hpad, text="Offline", font=("Segoe UI", 9), fg=FG3, bg=BG2)
        self.header_status_text.pack(side=tk.RIGHT, padx=(0, 4))

        content = tk.Frame(outer, bg=BG)
        content.pack(fill=tk.BOTH, expand=True, padx=16, pady=12)

        status_card = tk.Frame(content, bg=BG2)
        status_card.pack(fill=tk.X, pady=(0, 8))

        status_top = tk.Frame(status_card, bg=BG2)
        status_top.pack(fill=tk.X, padx=16, pady=(14, 0))

        self.status_dot = tk.Canvas(status_top, width=14, height=14, bg=BG2, highlightthickness=0)
        self.status_dot.pack(side=tk.LEFT, padx=(0, 10))
        self.status_dot.create_oval(2, 2, 12, 12, fill=RED, outline="")

        self.status_label = tk.Label(status_top, text="DISCONNECTED", font=("Segoe UI", 13, "bold"), fg=RED, bg=BG2)
        self.status_label.pack(side=tk.LEFT)

        self.last_sync_label = tk.Label(status_top, text="", font=("Segoe UI", 8), fg=FG3, bg=BG2)
        self.last_sync_label.pack(side=tk.RIGHT)

        sep1 = tk.Frame(status_card, bg=BORDER, height=1)
        sep1.pack(fill=tk.X, padx=16, pady=(10, 0))

        metrics_frame = tk.Frame(status_card, bg=BG2)
        metrics_frame.pack(fill=tk.X, padx=16, pady=(10, 14))
        metrics_frame.columnconfigure(0, weight=1)
        metrics_frame.columnconfigure(1, weight=1)
        metrics_frame.columnconfigure(2, weight=1)
        metrics_frame.columnconfigure(3, weight=1)

        self.acct_labels = {}
        fields = [("Account", 0), ("Broker", 1), ("Balance", 2), ("Equity", 3)]
        for label, col in fields:
            cell = tk.Frame(metrics_frame, bg=BG2)
            cell.grid(row=0, column=col, sticky="nsew", padx=(0, 4 if col < 3 else 0))
            tk.Label(cell, text=label.upper(), font=("Segoe UI", 7, "bold"), fg=FG3, bg=BG2).pack(anchor=tk.W)
            val = tk.Label(cell, text="--", font=("Segoe UI", 9, "bold"), fg=FG, bg=BG2, anchor=tk.W)
            val.pack(anchor=tk.W, pady=(2, 0))
            self.acct_labels[label.lower()] = val

        self.sync_count_label = tk.Label(content, text="", font=("Segoe UI", 8), fg=FG3, bg=BG)

        btn_row = tk.Frame(content, bg=BG)
        btn_row.pack(fill=tk.X, pady=(4, 0))

        self.toggle_btn = tk.Button(
            btn_row, text="▶  START SYNC", font=("Segoe UI", 10, "bold"),
            fg="#ffffff", bg=GREEN, activebackground="#059669", activeforeground="#ffffff",
            relief=tk.FLAT, cursor="hand2", command=self._toggle_sync, pady=10
        )
        self.toggle_btn.pack(side=tk.LEFT, fill=tk.X, expand=True)

        log_section = tk.Frame(content, bg=BG)
        log_section.pack(fill=tk.BOTH, expand=True, pady=(8, 0))

        log_header = tk.Frame(log_section, bg=BG)
        log_header.pack(fill=tk.X, pady=(0, 4))

        self.log_toggle_btn = tk.Button(
            log_header, text="▼ ACTIVITY LOG", font=("Segoe UI", 8, "bold"),
            fg=FG3, bg=BG, activebackground=BG, activeforeground=FG2,
            relief=tk.FLAT, cursor="hand2", command=self._toggle_log, bd=0
        )
        self.log_toggle_btn.pack(side=tk.LEFT)

        self.sync_count_label = tk.Label(log_header, text="0 syncs", font=("Segoe UI", 8), fg=FG3, bg=BG)
        self.sync_count_label.pack(side=tk.RIGHT)

        self.log_frame = tk.Frame(log_section, bg=BG)

        self.log_area = scrolledtext.ScrolledText(
            self.log_frame, height=8, font=("Consolas", 8),
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
        self.log_visible = True

        footer = tk.Frame(outer, bg=BG2, height=28)
        footer.pack(fill=tk.X, side=tk.BOTTOM)
        footer.pack_propagate(False)

        tk.Label(footer, text="Tradify MT5 Connector v5.0", font=("Segoe UI", 7), fg=FG3, bg=BG2).pack(side=tk.LEFT, padx=12)
        self.footer_status = tk.Label(footer, text="Ready", font=("Segoe UI", 7), fg=FG3, bg=BG2)
        self.footer_status.pack(side=tk.RIGHT, padx=12)

    def _toggle_log(self):
        if self.log_visible:
            self.log_frame.pack_forget()
            self.log_toggle_btn.configure(text="▶ ACTIVITY LOG")
            self.log_visible = False
        else:
            self.log_frame.pack(fill=tk.BOTH, expand=True)
            self.log_toggle_btn.configure(text="▼ ACTIVITY LOG")
            self.log_visible = True

    def _setup_tray(self):
        if not HAS_TRAY:
            self.root.protocol("WM_DELETE_WINDOW", self._on_close)
            return
        try:
            icon_img = make_icon_image(64)
            if not icon_img:
                self.root.protocol("WM_DELETE_WINDOW", self._on_close)
                return
            menu = pystray.Menu(
                pystray.MenuItem("Show Tradify", self._show_from_tray, default=True),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Quit", self._quit_from_tray)
            )
            self.tray_icon = pystray.Icon("tradify", icon_img, "Tradify MT5 Connector", menu)
            tray_thread = threading.Thread(target=self.tray_icon.run, daemon=True)
            tray_thread.start()
        except Exception:
            self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _on_minimize_to_tray(self):
        if self.tray_icon:
            self.root.withdraw()
            if self.is_syncing:
                try:
                    self.tray_icon.notify("Tradify is still syncing in the background.", "Tradify MT5")
                except Exception:
                    pass
        else:
            self._on_close()

    def _show_from_tray(self, icon=None, item=None):
        self.root.after(0, self.root.deiconify)
        self.root.after(10, self.root.lift)

    def _quit_from_tray(self, icon=None, item=None):
        if self.tray_icon:
            try:
                self.tray_icon.stop()
            except Exception:
                pass
        self.root.after(0, self._on_close)

    def _log(self, message, tag="info"):
        ts = datetime.now().strftime("%H:%M:%S")
        self.log_area.configure(state=tk.NORMAL)
        self.log_area.insert(tk.END, f"[{ts}] {message}\\n", tag)
        self.log_area.see(tk.END)

        lines = int(self.log_area.index('end-1c').split('.')[0])
        if lines > 200:
            self.log_area.delete('1.0', f'{lines - 200}.0')

        self.log_area.configure(state=tk.DISABLED)
        try:
            self.footer_status.configure(text=message[:60])
        except Exception:
            pass

    def _set_status(self, connected, text=None):
        self.mt5_connected = connected
        color = GREEN if connected else RED
        label = text or ("CONNECTED" if connected else "DISCONNECTED")
        self.status_dot.delete("all")
        self.status_dot.create_oval(2, 2, 12, 12, fill=color, outline="")
        self.status_label.configure(text=label, fg=color)
        h_color = GREEN if connected else RED
        h_text = "Online" if connected else "Offline"
        if text and text not in ("CONNECTED", "DISCONNECTED"):
            h_text = text
        self.header_status_dot.delete("all")
        self.header_status_dot.create_oval(1, 1, 9, 9, fill=h_color, outline="")
        self.header_status_text.configure(text=h_text, fg=h_color if connected else FG3)

    def _update_account(self, info):
        if info:
            self.acct_labels["account"].configure(text=str(info.login))
            self.acct_labels["broker"].configure(text=str(info.company)[:20])
            self.acct_labels["balance"].configure(text=f"{info.balance:,.2f}")
            self.acct_labels["equity"].configure(text=f"{info.equity:,.2f}")
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
                        if d.entry == 1:
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
        if self.tray_icon:
            try:
                self.tray_icon.stop()
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
                f"Python 3.8+ required.\\nYou have Python {sys.version}"
            )
        except Exception:
            print(f"Python 3.8+ required. You have {sys.version}")
        sys.exit(1)
    app = TradifyConnector()
    app.run()
`;

  const downloadConnector = () => {
    const element = document.createElement("a");
    const file = new Blob([pythonCode], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "tradify_connector.pyw";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast({
      title: "Downloading Connector",
      description: "tradify_connector.pyw is being downloaded.",
    });
  };

  const copyToClipboard = () => {
    if (!userRoleData?.syncToken) return;
    navigator.clipboard.writeText(userRoleData.syncToken);
    setCopied(true);
    toast({
      title: "Token Copied",
      description: "Paste this into your MT5 Connector app.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const troubleshootingItems = [
    {
      q: "MT5 connection failed / init error",
      a: "Make sure MetaTrader 5 is installed and running. You must be logged into a trading account. Keep the MT5 terminal open in the background while the connector runs."
    },
    {
      q: "Auth Error: Invalid or expired token",
      a: "Your sync token may have expired or been regenerated. Go to Step 1 above, generate a new token, then download a fresh connector file."
    },
    {
      q: "Network error / connection timeout",
      a: "Check your internet connection. The Tradify server may be temporarily unavailable. The connector will automatically retry every 10 seconds."
    },
    {
      q: "ModuleNotFoundError: No module named 'MetaTrader5'",
      a: "Run this command in your terminal: pip install MetaTrader5 requests. Make sure you're using the correct Python installation (the one where MT5 package is compatible — Windows only)."
    },
    {
      q: "Trades not appearing on dashboard",
      a: "The connector syncs every 10 seconds. Only closed trades appear in your journal. Make sure the connector shows 'CONNECTED' status and sync events in the log."
    },
  ];

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background" data-testid="page-mt5-bridge">
      <main className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-emerald-500/10 p-2.5 rounded-md">
              <Cpu className="text-emerald-500" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground uppercase tracking-tight" data-testid="text-page-title">
                MT5 Bridge
              </h1>
              <p className="text-sm text-muted-foreground">
                Connect MetaTrader 5 to Tradify for automatic trade sync
              </p>
            </div>
          </div>
        </div>

        <Card className="overflow-visible">
          <div className="p-5 flex items-center justify-between gap-4 border-b border-border flex-wrap">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-3 h-3 rounded-full",
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"
              )} />
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground" data-testid="text-connection-label">
                  Live Status
                </span>
                <p className={cn(
                  "text-sm font-bold uppercase tracking-tight",
                  isConnected ? "text-emerald-500" : "text-muted-foreground"
                )} data-testid="text-connection-status">
                  {isConnected ? "Connected & Syncing" : "Awaiting Connection"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isConnected && mt5?.metrics && (
                <div className="flex items-center gap-4 mr-2 flex-wrap">
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground block">Balance</span>
                    <span className="text-sm font-bold text-foreground" data-testid="text-balance">{mt5.metrics.balance}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground block">Equity</span>
                    <span className="text-sm font-bold text-foreground" data-testid="text-equity">{mt5.metrics.equity}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground block">P&L</span>
                    <span className={cn(
                      "text-sm font-bold",
                      parseFloat(mt5.metrics.floatingPl) >= 0 ? "text-emerald-500" : "text-red-500"
                    )} data-testid="text-floating-pl">{mt5.metrics.floatingPl}</span>
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground"
                onClick={() => refetch()}
                data-testid="button-refresh-status"
              >
                <RefreshCw size={14} className="mr-1.5" />
                Refresh
              </Button>
            </div>
          </div>

          {isConnected && mt5?.metrics?.positions && mt5.metrics.positions.length > 0 && (
            <div className="p-5 border-b border-border">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 block">
                Open Positions ({mt5.metrics.positions.length})
              </span>
              <div className="space-y-2">
                {mt5.metrics.positions.map((pos) => (
                  <div key={pos.ticket} className="flex items-center justify-between gap-2 text-xs bg-background rounded-md px-3 py-2 border border-border flex-wrap" data-testid={`position-row-${pos.ticket}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant={pos.type === "Buy" ? "default" : "destructive"} className="text-[10px] uppercase">
                        {pos.type}
                      </Badge>
                      <span className="font-bold text-foreground">{pos.symbol}</span>
                      <span className="text-muted-foreground">{pos.volume} lots</span>
                    </div>
                    <span className={cn(
                      "font-bold",
                      pos.profit >= 0 ? "text-emerald-500" : "text-red-500"
                    )}>{pos.profit >= 0 ? "+" : ""}{pos.profit.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <Card className="overflow-visible" data-testid="card-step-1">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-md flex items-center justify-center font-bold text-sm",
                  userRoleData?.syncToken
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-emerald-500 text-white"
                )}>
                  {userRoleData?.syncToken ? <Check size={16} /> : "1"}
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Generate Token</h3>
                  <p className="text-[10px] text-muted-foreground">One-time authentication key</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Generate your unique sync token. This authenticates the connector with your Tradify account securely.
              </p>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Your Sync Token</label>
                <div className="flex gap-2">
                  <div className={cn(
                    "flex-1 border rounded-md px-3 py-2 text-xs font-mono truncate",
                    userRoleData?.syncToken 
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" 
                      : "bg-muted border-border text-muted-foreground"
                  )} data-testid="text-sync-token">
                    {userRoleData?.syncToken || "No token generated yet"}
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={copyToClipboard}
                    disabled={!userRoleData?.syncToken}
                    data-testid="button-copy-token"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </Button>
                </div>
              </div>

              <Button 
                className={cn(
                  "w-full font-bold uppercase tracking-tight",
                  !userRoleData?.syncToken && "bg-emerald-500 hover:bg-emerald-600 text-white"
                )}
                variant={userRoleData?.syncToken ? "outline" : "default"}
                onClick={() => generateTokenMutation.mutate()}
                disabled={generateTokenMutation.isPending}
                data-testid="button-generate-token"
              >
                <Key size={14} className="mr-2" />
                {generateTokenMutation.isPending ? "Generating..." : userRoleData?.syncToken ? "Regenerate Token" : "Generate Token"}
              </Button>
            </div>
          </Card>

          <Card className={cn(
            "overflow-visible transition-opacity",
            !userRoleData?.syncToken && "opacity-50 pointer-events-none"
          )} data-testid="card-step-2">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-md flex items-center justify-center font-bold text-sm",
                  "bg-muted text-muted-foreground"
                )}>
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Download App</h3>
                  <p className="text-[10px] text-muted-foreground">Pre-configured connector</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Download the Tradify Connector app with your credentials already embedded. Just double-click to launch.
              </p>

              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Monitor size={14} className="text-emerald-500 shrink-0" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase">Desktop GUI App</span>
                </div>
                <ul className="text-[10px] text-muted-foreground space-y-1 pl-5 list-disc">
                  <li>Tradify-branded window with live status</li>
                  <li>Account info, sync log & start/stop control</li>
                  <li>Auto-reconnect on disconnect</li>
                </ul>
              </div>

              <Button 
                onClick={downloadConnector}
                disabled={!userRoleData?.syncToken}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold uppercase tracking-tight"
                data-testid="button-download-connector"
              >
                <Download size={14} className="mr-2" />
                Download Connector
              </Button>
            </div>
          </Card>

          <Card className={cn(
            "overflow-visible transition-opacity",
            !userRoleData?.syncToken && "opacity-50 pointer-events-none"
          )} data-testid="card-step-3">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-md flex items-center justify-center font-bold text-sm",
                  "bg-muted text-muted-foreground"
                )}>
                  3
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Run & Sync</h3>
                  <p className="text-[10px] text-muted-foreground">Launch the connector</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Open MetaTrader 5, log into your account, then double-click the downloaded file to launch:
              </p>

              <div className="bg-muted p-3 rounded-md border border-border font-mono text-xs text-foreground" data-testid="text-run-command">
                Double-click tradify_connector.pyw
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Requirements</span>
                <ul className="text-[10px] text-muted-foreground space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check size={10} className="text-emerald-500 shrink-0" />
                    <span>Windows 10/11 with Python 3.8+</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={10} className="text-emerald-500 shrink-0" />
                    <span>MetaTrader 5 terminal installed & logged in</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={10} className="text-emerald-500 shrink-0" />
                    <span>pip install MetaTrader5 requests</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        <Card className="overflow-visible" data-testid="card-troubleshooting">
          <button
            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            className="w-full p-5 flex items-center justify-between gap-2 text-left"
            data-testid="button-toggle-troubleshooting"
          >
            <div className="flex items-center gap-3">
              <HelpCircle size={18} className="text-muted-foreground shrink-0" />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Troubleshooting</h3>
                <p className="text-[10px] text-muted-foreground">Common issues and solutions</p>
              </div>
            </div>
            {showTroubleshooting ? (
              <ChevronUp size={16} className="text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown size={16} className="text-muted-foreground shrink-0" />
            )}
          </button>

          {showTroubleshooting && (
            <div className="px-5 pb-5 space-y-3">
              {troubleshootingItems.map((item, idx) => (
                <div key={idx} className="bg-background rounded-md p-4 border border-border" data-testid={`troubleshooting-item-${idx}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-xs font-bold text-foreground">{item.q}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-5">{item.a}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

      </main>
    </div>
  );
}
