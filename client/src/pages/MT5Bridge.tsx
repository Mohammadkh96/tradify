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
    queryKey: [`/api/mt5/status/${userId}`],
    refetchInterval: 1000, 
  });

  const pythonCode = `import MetaTrader5 as mt5
import requests
import time
import json
import sys
import os

# TRADIFY CONNECTOR v2.0 (PYTHON NATIVE)
# Requirements: pip install MetaTrader5 requests

def get_account_data():
    if not mt5.initialize():
        return None, f"MT5 Init Failed: {mt5.last_error()}"
    
    account_info = mt5.account_info()
    if account_info is None:
        mt5.shutdown()
        return None, "Failed to fetch Account Info (Is MT5 logged in?)"
        
    positions = mt5.positions_get()
    pos_list = []
    if positions:
        for p in positions:
            pos_list.append({
                "ticket": p.ticket,
                "symbol": p.symbol,
                "type": "Buy" if p.type == 0 else "Sell",
                "volume": p.volume,
                "price": p.price_open,
                "profit": p.profit,
                "sl": p.sl,
                "tp": p.tp
            })
            
    history = mt5.history_deals_get(time.time() - 86400*7, time.time())
    hist_list = []
    if history:
        for d in history:
            if d.entry == 1: 
                hist_list.append({
                    "ticket": d.ticket,
                    "symbol": d.symbol,
                    "type": d.type,
                    "volume": d.volume,
                    "price": d.price,
                    "profit": d.profit,
                    "commission": d.commission,
                    "swap": d.swap,
                    "open_time": d.time_msc // 1000,
                    "close_time": d.time
                })

    data = {
        "balance": float(account_info.balance),
        "equity": float(account_info.equity),
        "margin": float(account_info.margin),
        "freeMargin": float(account_info.margin_free),
        "marginLevel": float(account_info.margin_level),
        "floatingPl": float(account_info.profit),
        "leverage": int(account_info.leverage),
        "currency": account_info.currency,
        "positions": pos_list,
        "history": hist_list
    }
    return data, None

def run_bridge(user_id, token, api_url):
    print("="*50)
    print(" TRADIFY TERMINAL CONNECTOR ")
    print("="*50)
    print(f"[*] User: {user_id}")
    print(f"[*] API: {api_url}")
    print("[*] Status: Monitoring MT5...")
    
    while True:
        try:
            data, err = get_account_data()
            if err:
                print(f"[!] {err}")
                time.sleep(10)
                continue
                
            payload = {
                "userId": user_id,
                "token": token,
                **data
            }
            
            resp = requests.post(api_url, json=payload, timeout=15)
            if resp.status_code == 200:
                print(f"[+] Synced | Equity: {data['equity']} | {time.strftime('%H:%M:%S')}")
            else:
                print(f"[!] Sync Error ({resp.status_code}): {resp.text}")
                
        except Exception as e:
            print(f"[!] Error: {e}")
            
        time.sleep(10)

if __name__ == "__main__":
    USER_ID = "${userRoleData?.userId || "demo_user"}"
    SYNC_TOKEN = "${userRoleData?.syncToken || ""}"
    API_URL = "${window.location.origin}/api/mt5/sync"

    if not SYNC_TOKEN:
        print("[!] Error: No Sync Token found in settings.")
        sys.exit(1)

    try:
        run_bridge(USER_ID, SYNC_TOKEN, API_URL)
    except KeyboardInterrupt:
        mt5.shutdown()
        sys.exit(0)
`;

  const downloadConnector = () => {
    const element = document.createElement("a");
    const file = new Blob([pythonCode], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "tradify_connector.py";
    document.body.appendChild(element);
    element.click();
    toast({
      title: "Downloading Connector",
      description: "tradify_connector.py is being downloaded.",
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
                <ShieldCheck className="text-emerald-500" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Python Connector Setup</h1>
                <p className="text-xs text-slate-400">Sync MT5 directly from your device. No EA installation required.</p>
              </div>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Column: Form */}
            <div className="space-y-6">
              <div className="bg-slate-950/50 rounded-xl p-5 border border-slate-800">
                <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4">Step 1: Download Connector</h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Download the Tradify Python Bridge. This script runs locally and communicates with MT5 via the MetaTrader5 library.
                </p>
                <Button 
                  onClick={downloadConnector}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black uppercase tracking-tighter"
                >
                  <Download size={14} className="mr-2" />
                  Download tradify_connector.py
                </Button>
              </div>

              <div className="bg-slate-950/50 rounded-xl p-5 border border-slate-800">
                <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4">Step 2: Connection Credentials</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">User ID</label>
                    <div className="bg-[#020617] border border-slate-800 rounded-lg px-4 py-2 text-sm font-mono text-emerald-500">
                      {userRoleData?.userId}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Sync Token</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-[#020617] border border-slate-800 rounded-lg px-4 py-2 text-sm font-mono text-emerald-500 truncate">
                        {userRoleData?.syncToken || "Click Generate Below"}
                      </div>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="border-slate-800 text-slate-400"
                        onClick={copyToClipboard}
                        disabled={!userRoleData?.syncToken}
                      >
                        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    variant="outline"
                    className="w-full border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-widest h-10"
                    onClick={() => generateTokenMutation.mutate()}
                    disabled={generateTokenMutation.isPending}
                  >
                    {generateTokenMutation.isPending ? "Generating..." : "Generate New Token"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column: Execution */}
            <div className="space-y-6">
              <div className="bg-slate-950/50 rounded-xl p-5 border border-slate-800 h-full flex flex-col">
                <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4">Step 3: Run Connection</h3>
                <div className="flex-1 space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Ensure MetaTrader 5 is running on this device, then execute the script in your terminal:
                  </p>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
                    python tradify_connector.py
                  </div>
                  
                  <div className="mt-6 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-500 uppercase">Connector Requirements</span>
                    </div>
                    <ul className="text-[10px] text-slate-500 space-y-2 list-disc pl-4">
                      <li>Python 3.8+ installed on your device</li>
                      <li>MetaTrader5 python package (`pip install MetaTrader5 requests`)</li>
                      <li>MT5 Terminal must be open and logged in</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      mt5?.status === "CONNECTED" ? "bg-emerald-500 animate-pulse" : "bg-slate-700"
                    )} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {mt5?.status === "CONNECTED" ? "Live Sync Active" : "Waiting for Sync"}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-slate-500 hover:text-white h-auto p-0 text-[10px] uppercase font-bold"
                    onClick={() => refetch()}
                  >
                    <RefreshCw size={12} className="mr-1" />
                    Refresh
                  </Button>
                </div>
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
