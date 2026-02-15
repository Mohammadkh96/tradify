import { useState, useCallback } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from "lucide-react";

const PLATFORM_PRESETS: Record<string, { name: string; mappings: Record<string, string[]> }> = {
  mt4: {
    name: "MetaTrader 4/5",
    mappings: {
      pair: ["symbol", "instrument", "pair"],
      direction: ["type", "direction", "side", "order type"],
      entryPrice: ["open price", "entry price", "entry", "price"],
      exitPrice: ["close price", "exit price", "exit"],
      netPl: ["profit", "net pl", "p/l", "net profit", "pnl", "net p&l"],
      openTime: ["open time", "open date", "entry time", "entry date"],
      closeTime: ["close time", "close date", "exit time", "exit date"],
      volume: ["volume", "lots", "size", "quantity"],
      sl: ["s/l", "sl", "stop loss", "stoploss"],
      tp: ["t/p", "tp", "take profit", "takeprofit"],
      commission: ["commission", "comm"],
      swap: ["swap"],
      notes: ["comment", "notes", "memo"],
    },
  },
  tradingview: {
    name: "TradingView",
    mappings: {
      pair: ["symbol", "ticker"],
      direction: ["side", "type", "direction"],
      entryPrice: ["entry price", "avg entry", "price"],
      exitPrice: ["exit price", "avg exit", "close price"],
      netPl: ["profit", "pnl", "p&l", "net profit"],
      openTime: ["entry date", "open date", "date"],
      closeTime: ["exit date", "close date"],
      volume: ["qty", "quantity", "size", "contracts"],
      notes: ["notes", "comment"],
    },
  },
  generic: {
    name: "Generic CSV",
    mappings: {
      pair: ["pair", "symbol", "instrument", "ticker", "asset"],
      direction: ["direction", "side", "type", "action", "buy/sell"],
      entryPrice: ["entry price", "entry", "open price", "buy price"],
      exitPrice: ["exit price", "exit", "close price", "sell price"],
      netPl: ["profit", "pnl", "p/l", "net pl", "result", "net profit"],
      openTime: ["open time", "entry time", "open date", "entry date", "date"],
      closeTime: ["close time", "exit time", "close date", "exit date"],
      volume: ["volume", "lots", "size", "qty", "quantity"],
      sl: ["sl", "stop loss", "stoploss"],
      tp: ["tp", "take profit", "takeprofit"],
      commission: ["commission", "comm", "fee"],
      swap: ["swap"],
      notes: ["notes", "comment", "memo", "description"],
    },
  },
};

function findMapping(headers: string[], possibleNames: string[]): string | null {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  for (const name of possibleNames) {
    const idx = lowerHeaders.indexOf(name.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function normalizeDirection(val: string): string {
  const v = val.toLowerCase().trim();
  if (v === "buy" || v === "long" || v === "0") return "Long";
  if (v === "sell" || v === "short" || v === "1") return "Short";
  return val;
}

export default function CsvImportDialog() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("generic");
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importCount, setImportCount] = useState(0);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (trades: any[]) => {
      return apiRequest("POST", "/api/trades/import", { trades });
    },
    onSuccess: (_, variables) => {
      setImportCount(variables.length);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: `${variables.length} trades imported successfully` });
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          toast({ title: "Empty CSV", description: "No data rows found", variant: "destructive" });
          return;
        }
        setHeaders(results.meta.fields || []);
        setParsedData(results.data);
        setStep("preview");
      },
      error: (err) => {
        toast({ title: "Parse error", description: err.message, variant: "destructive" });
      },
    });
  }, [toast]);

  const handleImport = useCallback(() => {
    if (!parsedData || !headers.length) return;

    const preset = PLATFORM_PRESETS[platform];
    const mappings = preset.mappings;

    const columnMap: Record<string, string | null> = {};
    for (const [field, names] of Object.entries(mappings)) {
      columnMap[field] = findMapping(headers, names);
    }

    if (!columnMap.pair) {
      toast({ title: "Missing column", description: "Could not find a Symbol/Pair column", variant: "destructive" });
      return;
    }

    const trades = parsedData
      .map((row: any) => {
        const pair = columnMap.pair ? row[columnMap.pair] : "";
        if (!pair) return null;

        const direction = columnMap.direction ? normalizeDirection(row[columnMap.direction] || "") : "Long";
        const netPl = columnMap.netPl ? parseFloat(row[columnMap.netPl] || "0") : 0;
        let outcome = "Break-even";
        if (netPl > 0) outcome = "Win";
        else if (netPl < 0) outcome = "Loss";

        return {
          pair: pair.trim(),
          direction,
          timeframe: "Imported",
          entryPrice: columnMap.entryPrice ? row[columnMap.entryPrice] || "" : "",
          exitPrice: columnMap.exitPrice ? row[columnMap.exitPrice] || "" : "",
          riskReward: "",
          netPl: String(netPl),
          outcome,
          notes: columnMap.notes ? row[columnMap.notes] || `CSV Import: ${fileName}` : `CSV Import: ${fileName}`,
        };
      })
      .filter(Boolean);

    if (trades.length === 0) {
      toast({ title: "No valid trades", description: "Could not map any rows to trades", variant: "destructive" });
      return;
    }

    importMutation.mutate(trades);
  }, [parsedData, headers, platform, fileName, toast, importMutation]);

  const resetState = () => {
    setParsedData(null);
    setHeaders([]);
    setFileName("");
    setStep("upload");
    setImportCount(0);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/30 text-xs font-bold uppercase h-10 px-4"
          data-testid="button-csv-import"
        >
          <Upload className="mr-2 h-3.5 w-3.5" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            Import Trades from CSV
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Platform Format</label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="border-border" data-testid="select-csv-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_PRESETS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-emerald-500/30 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Drop your CSV file here or click to browse</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-emerald-500 file:text-white hover:file:bg-emerald-400 cursor-pointer"
                data-testid="input-csv-file"
              />
            </div>
          </div>
        )}

        {step === "preview" && parsedData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">{parsedData.length} trades detected</p>
              </div>
              <Button variant="ghost" size="sm" onClick={resetState} data-testid="button-csv-reset">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="bg-background border border-border rounded-lg p-3 max-h-[200px] overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {headers.slice(0, 5).map(h => (
                      <th key={h} className="text-left py-1 px-2 text-muted-foreground font-bold uppercase">{h}</th>
                    ))}
                    {headers.length > 5 && <th className="text-left py-1 px-2 text-muted-foreground">...</th>}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 5).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border/50">
                      {headers.slice(0, 5).map(h => (
                        <td key={h} className="py-1 px-2 text-foreground truncate max-w-[100px]">{row[h]}</td>
                      ))}
                      {headers.length > 5 && <td className="py-1 px-2 text-muted-foreground">...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 5 && <p className="text-[10px] text-muted-foreground text-center mt-2">+ {parsedData.length - 5} more rows</p>}
            </div>

            <Button
              onClick={handleImport}
              disabled={importMutation.isPending}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold uppercase"
              data-testid="button-csv-confirm-import"
            >
              {importMutation.isPending ? "Importing..." : `Import ${parsedData.length} Trades`}
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-foreground">{importCount} Trades Imported</p>
            <p className="text-sm text-muted-foreground mt-1">Your trades are now in your journal</p>
            <Button
              onClick={() => { setOpen(false); resetState(); }}
              className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold"
              data-testid="button-csv-done"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}