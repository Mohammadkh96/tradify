import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigation, MobileNav } from "@/components/Navigation";
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
  Play
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function MT5Bridge() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [accountNumber, setAccountNumber] = useState("1742554151");
  const [broker, setBroker] = useState("Exness");
  const userId = "demo_user";

  const { data: userRoleData } = useQuery<any>({
    queryKey: [`/api/traders-hub/user-role/${userId}`],
  });

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/traders-hub/generate-token", { userId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/traders-hub/user-role/${userId}`] });
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
      positions: Array<{
        symbol: string;
        type: string;
        volume: number;
        price_open: number;
        profit: number;
        ticket: number;
      }>;
    };
  }>({
    queryKey: [`/api/mt5/status/${userId}`],
    refetchInterval: 2000, 
  });

  const pythonCode = `import MetaTrader5 as mt5
import requests
import time
import json
import tkinter as tk
from tkinter import ttk, messagebox
import threading
import os

class MT5ConnectorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("TRADIFY MT5 Connector")
        self.root.geometry("600x500")
        
        self.api_url = tk.StringVar(value="https://${window.location.host}/api/mt5/sync")
        self.token = tk.StringVar()
        self.status_var = tk.StringVar(value="Not registered")
        self.is_running = False
        
        self.setup_ui()
        self.load_saved_token()

    def setup_ui(self):
        tab_control = ttk.Notebook(self.root)
        
        # Registration Tab
        reg_tab = ttk.Frame(tab_control)
        tab_control.add(reg_tab, text='Registration')
        
        ttk.Label(reg_tab, text="Token Registration", font=('Arial', 10, 'bold')).pack(pady=10, anchor='w', padx=20)
        
        ttk.Label(reg_tab, text="API URL:").pack(padx=20, anchor='w')
        ttk.Entry(reg_tab, textvariable=self.api_url, width=70).pack(padx=20, pady=5)
        
        ttk.Label(reg_tab, text="One-Time Token (from TRADIFY app):").pack(padx=20, anchor='w')
        ttk.Entry(reg_tab, textvariable=self.token, width=70).pack(padx=20, pady=5)
        
        btn_frame = ttk.Frame(reg_tab)
        btn_frame.pack(pady=20, padx=20, anchor='w')
        ttk.Button(btn_frame, text="Register", command=self.start_sync).pack(side='left')
        ttk.Button(btn_frame, text="Clear Saved Token", command=self.clear_token).pack(side='left', padx=10)
        
        # Status Section
        status_frame = ttk.LabelFrame(self.root, text="Status")
        status_frame.pack(fill="x", padx=20, pady=20)
        ttk.Label(status_frame, textvariable=self.status_var).pack(pady=10, padx=10)
        
        tab_control.pack(expand=1, fill="both")

    def start_sync(self):
        if not self.token.get():
            messagebox.showerror("Error", "Please enter a token")
            return
            
        # Try to save the token to the user's home directory instead of the current working directory
        # to avoid permission issues in protected folders like Downloads
        try:
            home_dir = os.path.expanduser("~")
            token_path = os.path.join(home_dir, "tradify_token.txt")
            with open(token_path, 'w') as f:
                f.write(self.token.get())
            print(f"Token saved to {token_path}")
        except Exception as e:
            print(f"Warning: Could not save token locally: {e}")
            
        if not self.is_running:
            self.is_running = True
            threading.Thread(target=self.sync_loop, daemon=True).start()
            self.status_var.set("Syncing...")

    def load_saved_token(self):
        try:
            home_dir = os.path.expanduser("~")
            token_path = os.path.join(home_dir, "tradify_token.txt")
            if os.path.exists(token_path):
                with open(token_path, 'r') as f:
                    self.token.set(f.read().strip())
        except:
            pass

    def clear_token(self):
        try:
            home_dir = os.path.expanduser("~")
            token_path = os.path.join(home_dir, "tradify_token.txt")
            if os.path.exists(token_path):
                os.remove(token_path)
            self.token.set("")
            messagebox.showinfo("Success", "Saved token cleared")
        except Exception as e:
            messagebox.showerror("Error", f"Could not clear token: {e}")

    def sync_loop(self):
        while self.is_running:
            try:
                if not mt5.initialize():
                    self.status_var.set("MT5 Initialize failed")
                    time.sleep(5)
                    continue
                    
                account_info = mt5.account_info()
                if account_info:
                    positions = mt5.positions_get()
                    # Fetch History (Last 100 trades for efficiency)
                    from_date = time.time() - (30 * 24 * 60 * 60) # Last 30 days
                    history = mt5.history_deals_get(from_date, time.time())
                    
                    payload = {
                        "userId": "${userId}",
                        "token": self.token.get(),
                        "balance": account_info.balance,
                        "equity": account_info.equity,
                        "margin": account_info.margin,
                        "freeMargin": account_info.margin_free,
                        "marginLevel": account_info.margin_level,
                        "floatingPl": account_info.profit,
                        "leverage": account_info.leverage,
                        "currency": account_info.currency,
                        "positions": [
                            {
                                "ticket": p.ticket,
                                "symbol": p.symbol,
                                "type": "Buy" if p.type == 0 else "Sell",
                                "volume": p.volume,
                                "price_open": p.price_open,
                                "sl": p.sl,
                                "tp": p.tp,
                                "profit": p.profit
                            } for p in positions
                        ] if positions else [],
                        "history": [
                            {
                                "ticket": d.ticket,
                                "symbol": d.symbol,
                                "type": "Buy" if d.type == 0 else "Sell",
                                "volume": d.volume,
                                "price_open": d.price_open,
                                "price_close": d.price_close,
                                "sl": getattr(d, 'sl', 0),
                                "tp": getattr(d, 'tp', 0),
                                "open_time": d.time,
                                "close_time": d.time_msc // 1000,
                                "profit": d.profit,
                                "commission": d.commission,
                                "swap": d.swap
                            } for d in history if d.entry == 1 # Only entry/exit pairs or deals
                        ] if history else []
                    }
                    
                    response = requests.post(self.api_url.get(), json=payload)
                    if response.status_code == 200:
                        self.status_var.set(f"Connected - Syncing active (Last: {time.strftime('%H:%M:%S')})")
                    else:
                        self.status_var.set(f"Error: {response.status_code}")
                
            except Exception as e:
                self.status_var.set(f"Connection Error: {str(e)}")
            
            time.sleep(2)

if __name__ == "__main__":
    root = tk.Tk()
    app = MT5ConnectorGUI(root)
    root.mainloop()`;

  const downloadConnector = () => {
    const element = document.createElement("a");
    const file = new Blob([pythonCode], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "tradify_connector_app.py";
    document.body.appendChild(element);
    element.click();
    toast({
      title: "Downloading Connector",
      description: "tradify_connector_app.py is being downloaded.",
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

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-6xl mx-auto">
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl max-w-4xl mx-auto">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-lg">
                <Server className="text-emerald-500" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">MT5 Connector (Token)</h1>
                <p className="text-xs text-slate-400">Generate a one-time token, paste it in the desktop connector, then refresh status.</p>
              </div>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Column: Form */}
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Account Number</label>
                <input 
                  type="text" 
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full bg-[#020617] border border-slate-800 rounded-lg px-4 py-3 text-sm font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Broker / Server</label>
                <input 
                  type="text" 
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  className="w-full bg-[#020617] border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <button 
                onClick={() => generateTokenMutation.mutate()}
                disabled={generateTokenMutation.isPending}
                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
              >
                {generateTokenMutation.isPending ? "Generating..." : "Generate Connection Token"}
              </button>

              {userRoleData?.syncToken && (
                <div className="bg-slate-950 border border-[#0ea5e9]/30 rounded-2xl p-6 relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2">
                      One-Time Token
                      <span className="text-slate-500 flex items-center gap-1 normal-case font-normal">
                        <Activity size={10} /> Expires in ~15 min
                      </span>
                    </span>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="flex-1 bg-[#0b1120] border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 break-all h-24 overflow-y-auto">
                      {userRoleData.syncToken}
                    </div>
                    <button 
                      onClick={copyToClipboard}
                      className="bg-slate-800 hover:bg-slate-700 p-4 rounded-lg self-start transition-colors"
                    >
                      {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} className="text-slate-400" />}
                    </button>
                  </div>

                  <div className="mt-4 flex items-start gap-2">
                    <div className="mt-1">🚀</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Download the connector below, run with Python, paste this token, and it will auto-register your MT5 connection.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <button 
                      onClick={downloadConnector}
                      className="bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 hover:bg-[#0ea5e9]/20 text-sky-400 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all"
                    >
                      <div className="flex items-center gap-1 font-bold text-xs uppercase tracking-tighter">
                        <Download size={14} /> Download
                      </div>
                      <span className="text-[10px] opacity-80">Connector (Python)</span>
                    </button>
                    <button 
                      className="bg-slate-800/50 border border-slate-700 hover:bg-slate-800 text-slate-400 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all"
                    >
                      <div className="flex items-center gap-1 font-bold text-xs uppercase tracking-tighter">
                        <Play size={14} /> Launcher
                      </div>
                      <span className="text-[10px] opacity-80">Script</span>
                    </button>
                  </div>

                  <div className="mt-6 p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                      <Terminal size={12} className="text-amber-500" />
                      Run: python mt5_connector_app.py
                    </div>
                    <div className="text-[10px] font-mono text-slate-600">
                      YOUR_TOKEN
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600 mt-4">
                <ShieldCheck size={12} />
                Token is one-time and expires quickly. No MT5 credentials are stored.
              </div>
            </div>

            {/* Right Column: Connections */}
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-emerald-500 font-bold text-lg">Connections</h3>
                <button 
                  onClick={() => refetch()}
                  className="text-slate-400 hover:text-white flex items-center gap-2 text-sm transition-colors"
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>

              <div className="flex-1 bg-[#020617] border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                {mt5?.status === "CONNECTED" ? (
                  <div className="space-y-4 w-full text-left">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                        <Activity size={24} className="text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold">Live Connection</h4>
                        <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          {mt5.status}
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 space-y-3 border border-slate-800">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Balance</span>
                        <span className="text-white font-mono">${parseFloat(mt5.metrics?.balance || "0").toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Equity</span>
                        <span className="text-emerald-500 font-mono">${parseFloat(mt5.metrics?.equity || "0").toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Margin Level</span>
                        <span className="text-white font-mono">{parseFloat(mt5.metrics?.marginLevel || "0").toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-sm max-w-[240px]">
                      No active connections yet. Generate a token and register via the connector.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
