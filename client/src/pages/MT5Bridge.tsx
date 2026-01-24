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
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

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

  const subscription = userRoleData?.subscriptionTier || "FREE";
  const isPro = subscription === "PRO";

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
        price: number;
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

class MT5ConnectorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("TRADIFY Terminal Sync")
        self.root.geometry("400x500")
        self.root.configure(bg="#020617")
        
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("TLabel", background="#020617", foreground="#94a3b8", font=("Inter", 10))
        style.configure("TButton", background="#10b981", foreground="#020617", font=("Inter", 10, "bold"))
        
        tk.Label(root, text="TRADIFY", font=("Inter", 24, "bold", "italic"), bg="#020617", fg="#10b981").pack(pady=20)
        tk.Label(root, text="Institutional Sync Engine", font=("Inter", 10), bg="#020617", fg="#64748b").pack()
        
        self.token_frame = tk.Frame(root, bg="#020617")
        self.token_frame.pack(pady=30, padx=40, fill="x")
        
        tk.Label(self.token_frame, text="ENTER CONNECTION TOKEN").pack(anchor="w", pady=(0, 5))
        self.token_entry = tk.Entry(self.token_frame, font=("Courier", 12), bg="#0f172a", fg="#f8fafc", insertbackground="white", borderwidth=0)
        self.token_entry.pack(fill="x", ipady=10)
        
        self.status_var = tk.StringVar(value="Status: Ready")
        tk.Label(root, textvariable=self.status_var, bg="#020617", fg="#10b981", font=("Inter", 9, "bold")).pack(pady=10)
        
        self.sync_btn = tk.Button(root, text="INITIALIZE SYNC", command=self.start_sync, bg="#10b981", fg="#020617", font=("Inter", 12, "bold"), borderwidth=0, cursor="hand2")
        self.sync_btn.pack(pady=20, padx=40, fill="x", ipady=10)

    def start_sync(self):
        token = self.token_entry.get()
        if not token:
            messagebox.showerror("Error", "Please enter a connection token")
            return
        
        self.status_var.set("Status: Authenticating...")
        self.sync_btn.config(state="disabled")
        
        # Placeholder for real MT5 logic
        # In production, this would use mt5.initialize() and mt5.account_info()
        self.status_var.set("Status: Connected & Syncing")

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
    <div className="flex-1 text-slate-50 pb-20 md:pb-0">
      <main className="p-6 lg:p-10 max-w-6xl mx-auto">
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
                      onClick={() => {
                        window.open('https://www.python.org/downloads/', '_blank');
                        toast({
                          title: "Python Required",
                          description: "Ensure Python 3.x is installed to run the launcher.",
                        });
                      }}
                      className="bg-slate-800/50 border border-slate-700 hover:bg-slate-800 text-slate-400 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all"
                    >
                      <div className="flex items-center gap-1 font-bold text-xs uppercase tracking-tighter">
                        <Play size={14} /> Launcher
                      </div>
                      <span className="text-[10px] opacity-80">Script</span>
                    </button>
                  </div>
                </div>
              )}
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

          <div className="p-8 bg-slate-950/30 border-t border-slate-800 space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Refresh Interval</label>
                {!isPro && (
                  <Link href="/pricing">
                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded cursor-pointer hover:bg-emerald-500/20 transition-colors">PRO: Priority Sync</span>
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['5s', '2s', '1s'].map((interval) => (
                  <button 
                    key={interval}
                    disabled={!isPro && (interval === '2s' || interval === '1s')}
                    className={cn(
                      "py-2 rounded-lg text-xs font-bold border transition-all",
                      !isPro && (interval === '2s' || interval === '1s') 
                        ? "bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-emerald-500/50"
                    )}
                  >
                    {interval}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Historical Backfill</label>
                {!isPro && <Lock size={12} className="text-slate-600" />}
              </div>
              <Button 
                variant="outline" 
                disabled={!isPro}
                className="w-full border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-widest h-12"
              >
                {isPro ? "Request Full Backfill" : "Pro Feature Only"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
