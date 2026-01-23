import { useQuery } from "@tanstack/react-query";
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
  Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function MT5Bridge() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const { data: mt5, isLoading, error, refetch } = useQuery<{
    isConnected: boolean;
    accountInfo?: {
      balance: number;
      equity: number;
      profit: number;
      margin_level: number;
    };
    positions?: Array<{
      symbol: string;
      type: string;
      volume: number;
      price_open: number;
      profit: number;
    }>;
  }>({
    queryKey: ["/api/mt5/status"],
    refetchInterval: 2000, 
  });

  const pythonCode = `import MetaTrader5 as mt5
import requests
import time
import json

# Configuration
SERVER_URL = "https://${window.location.host}/api/mt5/sync"
INTERVAL = 2  # Seconds between syncs

def collect_mt5_data():
    if not mt5.initialize():
        print("MT5 Initialize failed")
        return None
        
    account_info = mt5.account_info()
    if account_info is None:
        print("Failed to get account info")
        return None
        
    positions = mt5.positions_get()
    
    payload = {
        "account": {
            "balance": account_info.balance,
            "equity": account_info.equity,
            "profit": account_info.profit,
            "margin_level": account_info.margin_level
        },
        "positions": [
            {
                "symbol": p.symbol,
                "type": "Buy" if p.type == 0 else "Sell",
                "volume": p.volume,
                "price_open": p.price_open,
                "profit": p.profit
            } for p in positions
        ]
    }
    return payload

print("TRADIFY Python Connector Started")
while True:
    data = collect_mt5_data()
    if data:
        try:
            response = requests.post(SERVER_URL, json=data)
            if response.status_code == 200:
                print(f"Synced: Balance \${data['account']['balance']}")
            else:
                print(f"Error: Server returned {response.status_code}")
        except Exception as e:
            print(f"Connection Error: {e}")
            
    time.sleep(INTERVAL)`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopied(true);
    toast({
      title: "Connector Code Copied",
      description: "Save as tradify_connector.py and run on your local PC.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-6xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className={cn(
                "w-2 h-2 rounded-full",
                mt5?.isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              )} />
              <h1 className="text-3xl font-bold text-white tracking-tight">MT5 Standalone Connector</h1>
            </div>
            <p className="text-slate-400">Secure Desktop-to-Cloud Synchronization</p>
          </div>
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={16} className={cn(isLoading && "animate-spin")} />
            Sync Status
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <ShieldCheck size={18} />
                <h3 className="font-bold uppercase tracking-widest text-xs">Standalone Connector Required</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                To connect to MetaTrader 5, you must run the <strong>Standalone Python Connector</strong> on your local computer. 
                This app cannot access your local MT5 terminal directly from the cloud. The connector acts as a secure bridge between your terminal and this dashboard.
              </p>
            </div>

            {mt5?.isConnected ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Balance</span>
                      <Wallet className="text-emerald-500" size={18} />
                    </div>
                    <div className="text-2xl font-mono font-bold text-white">
                      ${mt5.accountInfo?.balance?.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Equity</span>
                      <Activity className="text-emerald-500" size={18} />
                    </div>
                    <div className="text-2xl font-mono font-bold text-white">
                      ${mt5.accountInfo?.equity?.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest">
                      <BarChart3 size={16} className="text-slate-500" />
                      Live Positions ({mt5.positions?.length || 0})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-950/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <th className="px-6 py-3">Symbol</th>
                          <th className="px-6 py-3">Type</th>
                          <th className="px-6 py-3 text-right">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {mt5.positions?.map((pos: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-white">{pos.symbol}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                pos.type === "Buy" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                              )}>
                                {pos.type}
                              </span>
                            </td>
                            <td className={cn(
                              "px-6 py-4 font-mono text-sm text-right font-bold",
                              pos.profit >= 0 ? "text-emerald-500" : "text-rose-500"
                            )}>
                              ${pos.profit?.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                  <AlertCircle size={40} className="text-rose-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Sync Offline</h3>
                <p className="text-slate-400 max-w-sm mx-auto mb-8 leading-relaxed">
                  Your MT5 terminal is not sending data. The dashboard is currently locked to prevent inaccurate data display.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Status: Waiting for Python Bridge...
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Cpu size={16} className="text-emerald-500" />
                Standalone Setup Instructions
              </h3>
              <ol className="space-y-4 text-sm text-slate-400">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-500">1</span>
                  <span><strong>Download Python:</strong> Ensure Python is installed on the computer running MT5.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-500">2</span>
                  <span><strong>Install Dependencies:</strong> Run <code className="text-emerald-500 text-[10px] bg-slate-950 px-1.5 py-0.5 rounded ml-1">pip install MetaTrader5 requests</code> in your command prompt.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-500">3</span>
                  <span><strong>Run Connector:</strong> Copy the code below, save it as <code className="text-emerald-500">tradify_connector.py</code>, and run it: <code className="text-emerald-500 text-[10px] bg-slate-950 px-1.5 py-0.5 rounded ml-1">python tradify_connector.py</code></span>
                </li>
              </ol>

              <div className="mt-6 relative group">
                <div className="absolute top-2 right-2 z-10">
                  <button 
                    onClick={copyToClipboard}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors text-slate-300"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="bg-slate-950 rounded-lg p-4 font-mono text-[10px] text-slate-500 h-80 overflow-y-auto border border-slate-800 group-hover:border-emerald-500/30 transition-colors">
                  <pre>{pythonCode}</pre>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Architecture Benefits</h3>
              <ul className="space-y-2">
                <li className="text-[11px] text-slate-400 flex items-center gap-2 italic">
                  <ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" />
                  Bypasses MT5 WebRequest SSL restrictions
                </li>
                <li className="text-[11px] text-slate-400 flex items-center gap-2 italic">
                  <ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" />
                  Zero latency synchronization (1-2s polling)
                </li>
                <li className="text-[11px] text-slate-400 flex items-center gap-2 italic">
                  <ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" />
                  Handles large history & position payloads
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
