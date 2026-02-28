import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Megaphone, FileText, BarChart3, Users, TrendingUp, ArrowUpRight, PenTool, Target, FolderOpen, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface MarketingStats {
  totalContent: number;
  contentByType: Record<string, number>;
  contentByPlatform: Record<string, number>;
  activeCampaigns: number;
  totalCampaigns: number;
  recentContent: Array<{
    id: number;
    type: string;
    platform: string;
    title: string;
    content: string;
    status: string;
    createdAt: string;
  }>;
  userInsights: {
    totalUsers: number;
    signupsThisWeek: number;
    signupsThisMonth: number;
    freeUsers: number;
    proUsers: number;
    eliteUsers: number;
    conversionRate: string;
  };
}

const typeColors: Record<string, string> = {
  post: "border-blue-500/30 text-blue-500",
  reel_script: "border-purple-500/30 text-purple-500",
  blog: "border-amber-500/30 text-amber-500",
  ad_copy: "border-rose-500/30 text-rose-500",
  email: "border-cyan-500/30 text-cyan-500",
};

const platformColors: Record<string, string> = {
  instagram: "border-pink-500/30 text-pink-500",
  facebook: "border-blue-500/30 text-blue-500",
  twitter: "border-sky-500/30 text-sky-500",
  linkedin: "border-blue-600/30 text-blue-600",
  tiktok: "border-fuchsia-500/30 text-fuchsia-500",
  meta_ads: "border-indigo-500/30 text-indigo-500",
  email: "border-cyan-500/30 text-cyan-500",
};

export default function MarketingDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading, isFetching, refetch } = useQuery<MarketingStats>({
    queryKey: ["/api/admin/marketing/stats"],
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 bg-background min-h-screen text-foreground" data-testid="marketing-dashboard-loading">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const contentByType = stats?.contentByType || {};
  const contentByPlatform = stats?.contentByPlatform || {};
  const userInsights = stats?.userInsights;
  const recentContent = stats?.recentContent || [];

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground" data-testid="marketing-dashboard">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-marketing-dashboard-title">
            <Megaphone /> Marketing Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold" data-testid="text-marketing-dashboard-subtitle">
            AI-Powered Content & Strategy
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-stats"
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/marketing/content-studio")}
            data-testid="button-quick-generate-post"
          >
            <PenTool size={16} className="mr-2" /> Generate Post
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/marketing/meta-ads")}
            data-testid="button-quick-generate-ad"
          >
            <Target size={16} className="mr-2" /> Generate Ad Copy
          </Button>
          <Button
            className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
            onClick={() => navigate("/admin/marketing/campaigns")}
            data-testid="button-quick-create-campaign"
          >
            <FolderOpen size={16} className="mr-2" /> Create Campaign
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border" data-testid="card-total-content">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-foreground" data-testid="text-total-content-count">{stats?.totalContent || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Total Content</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <FileText size={20} className="text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-active-campaigns">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-foreground" data-testid="text-active-campaigns-count">{stats?.activeCampaigns || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Active Campaigns</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-blue-500/10 flex items-center justify-center">
                <FolderOpen size={20} className="text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-total-users">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-foreground" data-testid="text-total-users-count">{userInsights?.totalUsers || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Total Users</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-purple-500/10 flex items-center justify-center">
                <Users size={20} className="text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-conversion-rate">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-emerald-500" data-testid="text-conversion-rate">{userInsights?.conversionRate || "0"}%</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Conversion Rate</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp size={20} className="text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border" data-testid="card-content-by-type">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-500" /> Content by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(contentByType).length === 0 ? (
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-content-type">No content generated yet. Start creating in the Content Studio.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(contentByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between gap-4" data-testid={`row-content-type-${type}`}>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${typeColors[type] || "border-muted-foreground/30 text-muted-foreground"}`}>
                        {type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, (count / (stats?.totalContent || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-foreground w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-content-by-platform">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-500" /> Content by Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(contentByPlatform).length === 0 ? (
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-content-platform">No content generated yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(contentByPlatform).map(([platform, count]) => (
                  <div key={platform} className="flex items-center justify-between gap-4" data-testid={`row-content-platform-${platform}`}>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${platformColors[platform] || "border-muted-foreground/30 text-muted-foreground"}`}>
                        {platform.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, (count / (stats?.totalContent || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-foreground w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border" data-testid="card-user-insights">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-emerald-500" /> User Data Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-md" data-testid="stat-signups-week">
                <div className="text-xl font-black text-foreground">{userInsights?.signupsThisWeek || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Signups This Week</div>
              </div>
              <div className="p-3 bg-muted rounded-md" data-testid="stat-signups-month">
                <div className="text-xl font-black text-foreground">{userInsights?.signupsThisMonth || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Signups This Month</div>
              </div>
              <div className="p-3 bg-muted rounded-md" data-testid="stat-free-users">
                <div className="text-xl font-black text-foreground">{userInsights?.freeUsers || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Free Users</div>
              </div>
              <div className="p-3 bg-muted rounded-md" data-testid="stat-pro-users">
                <div className="text-xl font-black text-emerald-500">{userInsights?.proUsers || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Pro Users</div>
              </div>
              <div className="p-3 bg-muted rounded-md" data-testid="stat-elite-users">
                <div className="text-xl font-black text-amber-500">{userInsights?.eliteUsers || 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Elite Users</div>
              </div>
              <div className="p-3 bg-muted rounded-md" data-testid="stat-conversion">
                <div className="text-xl font-black text-emerald-500">{userInsights?.conversionRate || "0"}%</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Free to Paid</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-recent-activity">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Clock size={16} className="text-emerald-500" /> Recent Content Activity
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/marketing/content-library")}
              data-testid="button-view-all-content"
            >
              View All <ArrowUpRight size={14} className="ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentContent.length === 0 ? (
              <div className="text-center py-8" data-testid="text-no-recent-activity">
                <p className="text-sm text-muted-foreground italic mb-4">No content created yet.</p>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/marketing/content-studio")}
                  data-testid="button-start-creating"
                >
                  <PenTool size={16} className="mr-2" /> Start Creating
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentContent.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-md"
                    data-testid={`row-recent-content-${item.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate" data-testid={`text-recent-title-${item.id}`}>
                        {item.title || item.content.substring(0, 60) + "..."}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={`text-[8px] font-black uppercase tracking-widest ${typeColors[item.type] || "border-muted-foreground/30 text-muted-foreground"}`}>
                          {item.type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className={`text-[8px] font-black uppercase tracking-widest ${platformColors[item.platform] || "border-muted-foreground/30 text-muted-foreground"}`}>
                          {item.platform.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono whitespace-nowrap" data-testid={`text-recent-date-${item.id}`}>
                      {item.createdAt ? format(new Date(item.createdAt), "MMM d") : "N/A"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border" data-testid="card-total-campaigns">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Total Campaigns</div>
              <div className="text-2xl font-black text-foreground" data-testid="text-total-campaigns-count">{stats?.totalCampaigns || 0}</div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/marketing/campaigns")}
              data-testid="button-manage-campaigns"
            >
              Manage Campaigns <ArrowUpRight size={14} className="ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}