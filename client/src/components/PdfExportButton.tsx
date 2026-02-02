import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/usePlan";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  FileDown, 
  Lock,
  Loader2
} from "lucide-react";
import { jsPDF } from "jspdf";

interface PdfExportButtonProps {
  userId: string;
  startDate?: string;
  endDate?: string;
}

interface ReportData {
  dateRange: string;
  generatedAt: string;
  dataSource: string;
  metrics: {
    totalTrades: number;
    wins: number;
    losses: number;
    breakeven: number;
    winRate: number;
    profitFactor: number | string;
    expectancy: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
    bestTrade: number;
    worstTrade: number;
  };
  sessionData: Array<{
    session: string;
    count: number;
    pnl: number;
    avgPnl: number;
  }>;
  symbolData: Array<{
    symbol: string;
    count: number;
    pnl: number;
    winRate: number;
  }>;
}

function generatePdf(data: ReportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const darkBlue = [26, 26, 46] as [number, number, number];
  const gray = [102, 102, 102] as [number, number, number];
  const lightGray = [136, 136, 136] as [number, number, number];
  const textColor = [51, 51, 51] as [number, number, number];
  const green = [22, 163, 74] as [number, number, number];
  const red = [220, 38, 38] as [number, number, number];
  
  let y = 20;
  
  doc.setFontSize(24);
  doc.setTextColor(...darkBlue);
  doc.text('TRADIFY', 20, y);
  
  y += 12;
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.text('Trading Performance Report', 20, y);
  
  y += 8;
  doc.setFontSize(8);
  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  doc.text(`Generated: ${generatedDate}`, 20, y);
  
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(`Period: ${data.dateRange}`, 20, y);
  
  y += 8;
  doc.setDrawColor(221, 221, 221);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 12;
  doc.setFontSize(14);
  doc.setTextColor(...darkBlue);
  doc.text('Performance Summary', 20, y);
  
  y += 10;
  const { metrics } = data;
  const col1 = 20, col2 = 60, col3 = 100, col4 = 145;
  
  const addMetric = (label: string, value: string, x: number, row: number) => {
    const rowY = y + (row * 18);
    doc.setFontSize(8);
    doc.setTextColor(...lightGray);
    doc.text(label, x, rowY);
    doc.setFontSize(11);
    doc.setTextColor(...darkBlue);
    doc.text(value, x, rowY + 6);
  };
  
  addMetric('Total Trades', metrics.totalTrades.toString(), col1, 0);
  addMetric('Win Rate', `${metrics.winRate.toFixed(1)}%`, col2, 0);
  addMetric('Profit Factor', metrics.profitFactor === 'Infinity' ? '∞' : Number(metrics.profitFactor).toFixed(2), col3, 0);
  addMetric('Expectancy', `$${metrics.expectancy.toFixed(2)}`, col4, 0);
  
  addMetric('Wins / Losses', `${metrics.wins} / ${metrics.losses}`, col1, 1);
  addMetric('Avg Win', `$${metrics.avgWin.toFixed(2)}`, col2, 1);
  addMetric('Avg Loss', `-$${metrics.avgLoss.toFixed(2)}`, col3, 1);
  addMetric('Total P&L', `${metrics.totalPnL >= 0 ? '+' : ''}$${metrics.totalPnL.toFixed(2)}`, col4, 1);
  
  addMetric('Best Trade', `+$${metrics.bestTrade.toFixed(2)}`, col1, 2);
  addMetric('Worst Trade', `$${metrics.worstTrade.toFixed(2)}`, col2, 2);
  addMetric('Breakeven', metrics.breakeven.toString(), col3, 2);
  addMetric('Data Source', data.dataSource, col4, 2);
  
  y += 60;
  doc.setDrawColor(221, 221, 221);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 10;
  doc.setFontSize(14);
  doc.setTextColor(...darkBlue);
  doc.text('Session Performance', 20, y);
  
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.text('Session', 20, y);
  doc.text('Trades', 70, y);
  doc.text('P&L', 100, y);
  doc.text('Avg P&L', 140, y);
  
  y += 5;
  doc.setDrawColor(238, 238, 238);
  doc.line(20, y, 170, y);
  y += 6;
  
  data.sessionData.forEach(session => {
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(session.session, 20, y);
    doc.text(session.count.toString(), 70, y);
    
    doc.setTextColor(session.pnl >= 0 ? green[0] : red[0], session.pnl >= 0 ? green[1] : red[1], session.pnl >= 0 ? green[2] : red[2]);
    doc.text(`${session.pnl >= 0 ? '+' : ''}$${session.pnl.toFixed(2)}`, 100, y);
    doc.text(`${session.avgPnl >= 0 ? '+' : ''}$${session.avgPnl.toFixed(2)}`, 140, y);
    y += 8;
  });
  
  y += 5;
  doc.setDrawColor(221, 221, 221);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 10;
  doc.setFontSize(14);
  doc.setTextColor(...darkBlue);
  doc.text('Instrument Breakdown', 20, y);
  
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.text('Symbol', 20, y);
  doc.text('Trades', 70, y);
  doc.text('Win Rate', 100, y);
  doc.text('P&L', 140, y);
  
  y += 5;
  doc.setDrawColor(238, 238, 238);
  doc.line(20, y, 170, y);
  y += 6;
  
  data.symbolData.forEach(symbol => {
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(symbol.symbol, 20, y);
    doc.text(symbol.count.toString(), 70, y);
    doc.text(`${symbol.winRate.toFixed(1)}%`, 100, y);
    
    doc.setTextColor(symbol.pnl >= 0 ? green[0] : red[0], symbol.pnl >= 0 ? green[1] : red[1], symbol.pnl >= 0 ? green[2] : red[2]);
    doc.text(`${symbol.pnl >= 0 ? '+' : ''}$${symbol.pnl.toFixed(2)}`, 140, y);
    y += 8;
  });
  
  doc.setFontSize(8);
  doc.setTextColor(153, 153, 153);
  doc.text('Generated by TRADIFY - Trading Journal Application', 20, 280);
  doc.text('This report is for personal use only. Not financial advice.', 20, 286);
  
  doc.save(`trading-report-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function PdfExportButton({ userId, startDate, endDate }: PdfExportButtonProps) {
  const { isPro, isElite } = usePlan();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const canExport = isPro || isElite;

  const handleExport = async () => {
    if (!canExport) {
      toast({
        title: "Upgrade Required",
        description: "PDF reports are available for Pro and Elite subscribers.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      
      const url = `/api/pdf-report/${userId}${params.toString() ? `?${params}` : ''}`;
      
      const response = await fetch(url, { credentials: 'include' });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate PDF');
      }
      
      const data: ReportData = await response.json();
      generatePdf(data);
      
      toast({
        title: "Report Downloaded",
        description: "Your PDF report has been generated and downloaded.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate PDF report.";
      toast({
        title: "Export Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!canExport) {
    return (
      <Link to="/profile">
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
          data-testid="button-pdf-upgrade"
        >
          <Lock className="h-4 w-4" />
          PDF Report
        </Button>
      </Link>
    );
  }

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleExport}
      disabled={isLoading}
      className="gap-2"
      data-testid="button-export-pdf"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
      PDF Report
    </Button>
  );
}
