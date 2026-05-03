import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, DollarSign, Users, Award } from "lucide-react";

interface Affiliate {
  referrerEmail: string;
  referralCode: string;
  referralCount: number;
  paidCount: number;
  commissionOwedUsd: string;
}

interface AffiliatesResponse {
  commissionPerReferralUsd: number;
  totalAffiliates: number;
  totalPaidReferrals: number;
  totalCommissionOwedUsd: string;
  affiliates: Affiliate[];
}

export default function Affiliates() {
  const { data, isLoading } = useQuery<AffiliatesResponse>({
    queryKey: ["/api/admin/affiliates"],
  });

  const downloadCsv = () => {
    window.location.href = "/api/admin/affiliates.csv";
  };

  return (
    <div className="p-8 space-y-6 bg-background min-h-screen text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-affiliates-title">Affiliate Payouts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ${data?.commissionPerReferralUsd ?? 10} commission per active paid referral (PRO / ELITE / COACH)
          </p>
        </div>
        <Button onClick={downloadCsv} data-testid="button-export-affiliates-csv" disabled={isLoading || !data?.affiliates?.length}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-stat-affiliates">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Active Affiliates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-affiliates">{data?.totalAffiliates ?? 0}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-paid-referrals">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" /> Paid Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-paid-referrals">{data?.totalPaidReferrals ?? 0}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-commission">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Commission Owed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-commission">${data?.totalCommissionOwedUsd ?? "0.00"}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Affiliate Roster</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-12">Loading…</div>
          ) : !data?.affiliates?.length ? (
            <div className="text-center text-sm text-muted-foreground py-12" data-testid="text-no-affiliates">
              No affiliates with referrals yet.
            </div>
          ) : (
            <Table data-testid="table-affiliates">
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer (PayPal Email)</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Total Referrals</TableHead>
                  <TableHead className="text-right">Paid Referrals</TableHead>
                  <TableHead className="text-right">Commission Owed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.affiliates.map((a) => (
                  <TableRow key={a.referralCode} data-testid={`row-affiliate-${a.referralCode}`}>
                    <TableCell className="font-medium" data-testid={`text-affiliate-email-${a.referralCode}`}>{a.referrerEmail}</TableCell>
                    <TableCell><Badge variant="outline">{a.referralCode}</Badge></TableCell>
                    <TableCell className="text-right">{a.referralCount}</TableCell>
                    <TableCell className="text-right" data-testid={`text-affiliate-paid-${a.referralCode}`}>{a.paidCount}</TableCell>
                    <TableCell className="text-right font-semibold" data-testid={`text-affiliate-commission-${a.referralCode}`}>
                      ${a.commissionOwedUsd}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
