import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Plus, Target, Pencil, Trash2, ArrowLeft, FolderOpen, Calendar, DollarSign, FileText, Mail, Megaphone } from "lucide-react";
import type { MarketingCampaign, MarketingContent, MarketingAdStrategy, MarketingEmailSequence } from "@shared/schema";

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

const campaignTypeLabels: Record<string, string> = {
  content_series: "Content Series",
  meta_ads: "Meta Ads",
  email_sequence: "Email Sequence",
  launch: "Launch",
};

const statusColors: Record<string, string> = {
  planning: "border-amber-500/30 text-amber-500",
  active: "border-emerald-500/30 text-emerald-500",
  completed: "border-blue-500/30 text-blue-500",
};

export default function MarketingCampaigns() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [viewingCampaign, setViewingCampaign] = useState<MarketingCampaign | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    goal: "",
    type: "content_series",
    description: "",
    budget: "",
    startDate: "",
    endDate: "",
    targetAudience: "",
    notes: "",
    status: "planning",
  });

  const { data: campaigns, isLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/admin/marketing/campaigns"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/marketing/campaigns", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/campaigns"] });
      resetForm();
      toast({ title: "Campaign Created", description: "New marketing campaign has been created." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to create campaign." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/marketing/campaigns/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/campaigns"] });
      resetForm();
      toast({ title: "Campaign Updated", description: "Campaign has been updated." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to update campaign." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/marketing/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/campaigns"] });
      toast({ title: "Deleted", description: "Campaign has been deleted." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete campaign." });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingCampaign(null);
    setFormData({
      name: "",
      goal: "",
      type: "content_series",
      description: "",
      budget: "",
      startDate: "",
      endDate: "",
      targetAudience: "",
      notes: "",
      status: "planning",
    });
  };

  const startEdit = (campaign: MarketingCampaign) => {
    setEditingCampaign(campaign);
    setViewingCampaign(null);
    setShowForm(true);
    setFormData({
      name: campaign.name || "",
      goal: campaign.goal || "",
      type: campaign.type || "content_series",
      description: campaign.description || "",
      budget: campaign.budget || "",
      startDate: campaign.startDate ? format(new Date(campaign.startDate), "yyyy-MM-dd") : "",
      endDate: campaign.endDate ? format(new Date(campaign.endDate), "yyyy-MM-dd") : "",
      targetAudience: campaign.targetAudience || "",
      notes: campaign.notes || "",
      status: campaign.status || "planning",
    });
  };

  const handleSubmit = () => {
    const payload: any = {
      ...formData,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
    };
    if (editingCampaign) {
      updateMutation.mutate({ id: editingCampaign.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this campaign?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (viewingCampaign) {
    return <CampaignDetailView campaign={viewingCampaign} onBack={() => setViewingCampaign(null)} onEdit={() => startEdit(viewingCampaign)} />;
  }

  if (showForm) {
    return (
      <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-campaign-form-title">
              <Target /> {editingCampaign ? "Edit Campaign" : "New Campaign"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">
              {editingCampaign ? "Update campaign details" : "Create a new marketing campaign"}
            </p>
          </div>
          <Button variant="outline" onClick={resetForm} data-testid="button-cancel-campaign">
            <ArrowLeft size={14} className="mr-2" /> Back to List
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Campaign Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Q1 Launch Campaign"
                  className="bg-muted border-border"
                  data-testid="input-campaign-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Campaign Type</label>
                <Select value={formData.type} onValueChange={(val) => setFormData((prev) => ({ ...prev, type: val }))}>
                  <SelectTrigger className="bg-muted border-border" data-testid="select-campaign-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="content_series">Content Series</SelectItem>
                    <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    <SelectItem value="email_sequence">Email Sequence</SelectItem>
                    <SelectItem value="launch">Launch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Goal</label>
              <Input
                value={formData.goal}
                onChange={(e) => setFormData((prev) => ({ ...prev, goal: e.target.value }))}
                placeholder="e.g., Increase signups by 50%"
                className="bg-muted border-border"
                data-testid="input-campaign-goal"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the campaign strategy and objectives..."
                className="bg-muted border-border"
                rows={4}
                data-testid="textarea-campaign-description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Budget</label>
                <Input
                  value={formData.budget}
                  onChange={(e) => setFormData((prev) => ({ ...prev, budget: e.target.value }))}
                  placeholder="e.g., $5,000"
                  className="bg-muted border-border"
                  data-testid="input-campaign-budget"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Start Date</label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="bg-muted border-border"
                  data-testid="input-campaign-start-date"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">End Date</label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="bg-muted border-border"
                  data-testid="input-campaign-end-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Target Audience</label>
                <Input
                  value={formData.targetAudience}
                  onChange={(e) => setFormData((prev) => ({ ...prev, targetAudience: e.target.value }))}
                  placeholder="e.g., Retail forex traders aged 25-40"
                  className="bg-muted border-border"
                  data-testid="input-campaign-audience"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</label>
                <Select value={formData.status} onValueChange={(val) => setFormData((prev) => ({ ...prev, status: val }))}>
                  <SelectTrigger className="bg-muted border-border" data-testid="select-campaign-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes or reminders..."
                className="bg-muted border-border"
                rows={3}
                data-testid="textarea-campaign-notes"
              />
            </div>

            <div className="flex items-center justify-end gap-4 pt-4">
              <Button variant="outline" onClick={resetForm} data-testid="button-campaign-cancel">
                Cancel
              </Button>
              <Button
                className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || !formData.name || !formData.type}
                data-testid="button-campaign-save"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingCampaign ? "Update Campaign" : "Create Campaign"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCampaigns = campaigns?.filter(c => c.status === "active").length || 0;
  const planningCampaigns = campaigns?.filter(c => c.status === "planning").length || 0;
  const completedCampaigns = campaigns?.filter(c => c.status === "completed").length || 0;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-campaigns-title">
            <Target /> Marketing Campaigns
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Organize & Track Campaigns</p>
        </div>
        <Button
          className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
          onClick={() => { resetForm(); setShowForm(true); }}
          data-testid="button-new-campaign"
        >
          <Plus size={16} className="mr-2" /> New Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-foreground" data-testid="text-total-campaigns">{campaigns?.length || 0}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Total Campaigns</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-emerald-500" data-testid="text-active-campaigns">{activeCampaigns}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Active</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-amber-500" data-testid="text-planning-campaigns">{planningCampaigns}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Planning</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-blue-500" data-testid="text-completed-campaigns">{completedCampaigns}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Completed</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Campaign</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Type</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Status</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Budget</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Date Range</TableHead>
              <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns?.map((campaign) => (
              <TableRow
                key={campaign.id}
                className="border-border hover:bg-muted/40 cursor-pointer"
                onClick={() => setViewingCampaign(campaign)}
                data-testid={`row-campaign-${campaign.id}`}
              >
                <TableCell>
                  <div className="font-bold text-foreground text-sm" data-testid={`text-campaign-name-${campaign.id}`}>{campaign.name}</div>
                  {campaign.goal && <div className="text-[10px] text-muted-foreground mt-0.5">{campaign.goal}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-muted-foreground/30 text-muted-foreground">
                    {campaignTypeLabels[campaign.type] || campaign.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", statusColors[campaign.status] || statusColors.planning)}>
                    {campaign.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs font-mono">
                  {campaign.budget || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-[10px] font-mono">
                  {campaign.startDate ? format(new Date(campaign.startDate), "MMM d") : "—"}
                  {campaign.startDate && campaign.endDate ? " — " : ""}
                  {campaign.endDate ? format(new Date(campaign.endDate), "MMM d, yyyy") : ""}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(campaign)}
                      data-testid={`button-edit-campaign-${campaign.id}`}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-rose-500"
                      onClick={() => handleDelete(campaign.id)}
                      data-testid={`button-delete-campaign-${campaign.id}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!campaigns || campaigns.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-sm border-0">
                  <FolderOpen size={48} className="mx-auto text-muted-foreground mb-4 opacity-40" />
                  No campaigns yet. Click "New Campaign" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function CampaignDetailView({ campaign, onBack, onEdit }: { campaign: MarketingCampaign; onBack: () => void; onEdit: () => void }) {
  const { data: allContent } = useQuery<MarketingContent[]>({
    queryKey: ["/api/admin/marketing/content"],
  });

  const { data: adStrategies } = useQuery<MarketingAdStrategy[]>({
    queryKey: ["/api/admin/marketing/ad-strategies", campaign.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/marketing/ad-strategies?campaignId=${campaign.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: emailSequences } = useQuery<MarketingEmailSequence[]>({
    queryKey: ["/api/admin/marketing/email-sequences", campaign.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/marketing/email-sequences?campaignId=${campaign.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const campaignContent = allContent?.filter(c => c.campaignId === campaign.id) || [];

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-campaign-detail-title">
            <Target /> {campaign.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">
            {campaignTypeLabels[campaign.type] || campaign.type} Campaign
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onBack} data-testid="button-back-campaigns">
            <ArrowLeft size={14} className="mr-2" /> Back
          </Button>
          <Button
            className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
            onClick={onEdit}
            data-testid="button-edit-campaign-detail"
          >
            <Pencil size={14} className="mr-2" /> Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              Campaign Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaign.goal && (
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Goal</label>
                <p className="text-sm text-foreground mt-1" data-testid="text-campaign-goal">{campaign.goal}</p>
              </div>
            )}
            {campaign.description && (
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Description</label>
                <p className="text-sm text-foreground mt-1" data-testid="text-campaign-description">{campaign.description}</p>
              </div>
            )}
            {campaign.targetAudience && (
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Target Audience</label>
                <p className="text-sm text-foreground mt-1">{campaign.targetAudience}</p>
              </div>
            )}
            {campaign.notes && (
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Notes</label>
                <p className="text-sm text-muted-foreground mt-1">{campaign.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Status</span>
              <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", statusColors[campaign.status] || statusColors.planning)}>
                {campaign.status}
              </Badge>
            </div>
            {campaign.budget && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1"><DollarSign size={10} /> Budget</span>
                <span className="text-sm font-bold text-foreground">{campaign.budget}</span>
              </div>
            )}
            {campaign.startDate && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Calendar size={10} /> Start</span>
                <span className="text-xs font-mono text-foreground">{format(new Date(campaign.startDate), "MMM d, yyyy")}</span>
              </div>
            )}
            {campaign.endDate && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Calendar size={10} /> End</span>
                <span className="text-xs font-mono text-foreground">{format(new Date(campaign.endDate), "MMM d, yyyy")}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1"><FileText size={10} /> Content</span>
              <span className="text-sm font-bold text-foreground">{campaignContent.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <FileText size={16} className="text-emerald-500" /> Associated Content
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Content pieces linked to this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {campaignContent.length > 0 ? (
            <div className="space-y-3">
              {campaignContent.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-md" data-testid={`content-item-${item.id}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">{item.type}</Badge>
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">{item.platform}</Badge>
                    </div>
                    <p className="text-sm text-foreground mt-1 line-clamp-2">{item.title || item.content?.substring(0, 100)}</p>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono ml-4">
                    {item.createdAt ? format(new Date(item.createdAt), "MMM d") : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-8">No content linked to this campaign yet.</p>
          )}
        </CardContent>
      </Card>

      {adStrategies && adStrategies.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Megaphone size={16} className="text-emerald-500" /> Ad Strategies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {adStrategies.map((strategy) => (
                <div key={strategy.id} className="p-3 bg-muted rounded-md" data-testid={`ad-strategy-${strategy.id}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">{strategy.campaignType}</Badge>
                    {strategy.bidStrategy && <Badge variant="outline" className="text-[9px] uppercase tracking-widest">{strategy.bidStrategy}</Badge>}
                  </div>
                  {strategy.objective && <p className="text-sm text-foreground mt-1">{strategy.objective}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {emailSequences && emailSequences.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Mail size={16} className="text-emerald-500" /> Email Sequences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {emailSequences.map((seq) => (
                <div key={seq.id} className="flex items-center justify-between p-3 bg-muted rounded-md" data-testid={`email-seq-${seq.id}`}>
                  <div>
                    <p className="text-sm font-bold text-foreground">{seq.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{seq.subjectLine}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">{seq.recipientSegment}</Badge>
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      seq.status === "sent" ? "border-emerald-500/30 text-emerald-500" : "border-amber-500/30 text-amber-500"
                    )}>
                      {seq.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
