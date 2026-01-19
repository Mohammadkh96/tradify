import { useQuery } from "@tanstack/react-query";
import { Navigation, MobileNav } from "@/components/Navigation";
import { 
  Activity, 
  Wallet, 
  BarChart3, 
  RefreshCw, 
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Terminal,
  Copy,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function MT5Bridge() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const { data: mt5, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/mt5/status"],
    refetchInterval: 2000, 
  });

  const eaCode = `// TRADIFY MT5 Bridge EA
#property copyright "TRADIFY"
#property version   "1.00"
#property strict

input string ServerURL = "https://${window.location.host}/api/mt5/update";
input int UpdateInterval = 2; // seconds

int OnInit() {
   EventSetTimer(UpdateInterval);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   EventKillTimer();
}

void OnTimer() {
   string json = "{";
   json += "\\"account\\":{";
   json += "\\"balance\\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\\"equity\\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\\"profit\\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + ",";
   json += "\\"margin_level\\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2);
   json += "},\\"positions\\":[";
   
   int pos_count = 0;
   for(int i=0; i<PositionsTotal(); i++) {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket)) {
         if(pos_count > 0) json += ",";
         json += "{";
         json += "\\"symbol\\":\\"" + PositionGetString(POSITION_SYMBOL) + "\\",";
         json += "\\"type\\":\\"" + (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "Buy" : "Sell") + "\\",";
         json += "\\"volume\\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ",";
         json += "\\"price_open\\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 5) + ",";
         json += "\\"profit\\":" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2);
         json += "}";
         pos_count++;
      }
   }
   json += "]}";

   char data[];
   ArrayResize(data, StringLen(json));
   StringToCharArray(json, data);
   
   string headers = "Content-Type: application/json\\r\\n";
   char result[];
   string result_headers;
   
   int res = WebRequest("POST", ServerURL, headers, 1000, data, result, result_headers);
   if(res == -1) Print("TRADIFY ERROR: WebRequest failed (", GetLastError(), "). Make sure URL is allowed in Options.");
   else if(res >= 400) Print("TRADIFY ERROR: Server returned status ", res);
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(eaCode);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "Paste this into your MetaEditor and compile as an EA.",
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
                mt5 ? "bg-emerald-500 animate-pulse" : "bg-slate-700"
              )} />
              <h1 className="text-3xl font-bold text-white tracking-tight">MT5 Bridge</h1>
            </div>
            <p className="text-slate-400">Local Device MetaTrader 5 Synchronization</p>
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
            {error ? (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-8 text-center">
                <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Bridge Connection Error</h3>
                <p className="text-slate-400">Could not establish connection to the MT5 export bridge.</p>
              </div>
            ) : !mt5 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                <Zap size={48} className="mx-auto text-slate-700 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Bridge Inactive</h3>
                <p className="text-slate-400 max-w-md mx-auto mb-6">
                  To connect your local MT5 terminal, you need to install the TRADIFY Bridge script.
                </p>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-left mb-6">
                  <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <ShieldCheck size={14} /> Security Note
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This bridge only exports your account data to TRADIFY for journaling. It <strong>cannot</strong> execute trades or modify your account.
                  </p>
                </div>
              </div>
            ) : (
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
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Profit/Loss</span>
                      <Activity className={cn(mt5.accountInfo?.profit >= 0 ? "text-emerald-500" : "text-rose-500")} size={18} />
                    </div>
                    <div className={cn(
                      "text-2xl font-mono font-bold",
                      mt5.accountInfo?.profit >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      ${mt5.accountInfo?.profit?.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest">
                      <BarChart3 size={16} className="text-slate-500" />
                      Open Positions ({mt5.positions?.length || 0})
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
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Terminal size={16} className="text-emerald-500" />
                Integration Steps
              </h3>
              <ol className="space-y-4 text-sm text-slate-400">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-500">1</span>
                  <span>Open MetaTrader 5 on your device.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-500">2</span>
                  <span>Go to <strong>Tools &gt; Options &gt; Expert Advisors</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-500">3</span>
                  <span>Enable <strong>"Allow WebRequest for listed URL"</strong> and add: <code className="text-emerald-500 text-xs block mt-1 break-all bg-slate-950 p-1 rounded">https://{window.location.host}</code></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-500">4</span>
                  <span>Open <strong>MetaEditor</strong> (F4), create a new Expert Advisor, and paste the code below.</span>
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
                <div className="bg-slate-950 rounded-lg p-4 font-mono text-[10px] text-slate-500 h-48 overflow-y-auto border border-slate-800 group-hover:border-emerald-500/30 transition-colors">
                  <pre>{eaCode}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
