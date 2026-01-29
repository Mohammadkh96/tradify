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

interface PdfExportButtonProps {
  userId: string;
  startDate?: string;
  endDate?: string;
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
      
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `trading-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: "Report Downloaded",
        description: "Your PDF report has been generated and downloaded.",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to generate PDF report.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!canExport) {
    return (
      <Link href="/profile">
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