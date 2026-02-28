import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { Search, Library, Star, Trash2, Pencil, X, Calendar, LayoutGrid, AlertTriangle, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import type { MarketingContent } from "@shared/schema";

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

const typeColors: Record<string, string> = {
  post: "border-blue-500/30 text-blue-500",
  reel_script: "border-purple-500/30 text-purple-500",
  blog: "border-emerald-500/30 text-emerald-500",
  ad_copy: "border-amber-500/30 text-amber-500",
  email: "border-cyan-500/30 text-cyan-500",
};

const platformColors: Record<string, string> = {
  instagram: "border-pink-500/30 text-pink-500",
  facebook: "border-blue-600/30 text-blue-600",
  twitter: "border-sky-500/30 text-sky-500",
  linkedin: "border-blue-700/30 text-blue-700",
  tiktok: "border-fuchsia-500/30 text-fuchsia-500",
  meta_ads: "border-indigo-500/30 text-indigo-500",
  email: "border-cyan-500/30 text-cyan-500",
};

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "used", label: "Used" },
  { value: "archived", label: "Archived" },
];

const typeOptions = [
  { value: "all", label: "All Types" },
  { value: "post", label: "Post" },
  { value: "reel_script", label: "Reel Script" },
  { value: "blog", label: "Blog" },
  { value: "ad_copy", label: "Ad Copy" },
  { value: "email", label: "Email" },
];

const platformOptions = [
  { value: "all", label: "All Platforms" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter/X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "email", label: "Email" },
];

export default function ContentLibrary() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  const [selectedContent, setSelectedContent] = useState<MarketingContent | null>(null);
  const [editingContent, setEditingContent] = useState<MarketingContent | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const { data: content, isLoading } = useQuery<MarketingContent[]>({
    queryKey: ["/api/admin/marketing/content"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/marketing/content/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/content"] });
      setEditingContent(null);
      setSelectedContent(null);
      toast({ title: "Updated", description: "Content has been updated." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to update content." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/marketing/content/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketing/content"] });
      setSelectedContent(null);
      toast({ title: "Deleted", description: "Content has been deleted." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete content." });
    },
  });

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this content?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleRate = (id: number, rating: number) => {
    updateMutation.mutate({ id, data: { performanceRating: rating } });
  };

  const handleStatusChange = (id: number, status: string) => {
    updateMutation.mutate({ id, data: { status } });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Content copied to clipboard." });
  };

  const filteredContent = content?.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (filterPlatform !== "all" && item.platform !== filterPlatform) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchContent = item.content?.toLowerCase().includes(q);
      const matchHook = item.hook?.toLowerCase().includes(q);
      const matchHashtags = item.hashtags?.toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchHook && !matchHashtags) return false;
    }
    return true;
  }) || [];

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const totalContent = content?.length || 0;
  const draftCount = content?.filter(c => c.status === "draft").length || 0;
  const approvedCount = content?.filter(c => c.status === "approved").length || 0;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-content-library-title">
            <Library /> Content Library
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">All Generated Marketing Content</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
            data-testid="button-view-grid"
          >
            <LayoutGrid size={16} />
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("calendar")}
            data-testid="button-view-calendar"
          >
            <Calendar size={16} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-foreground" data-testid="text-total-content">{totalContent}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Total Content</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-amber-500" data-testid="text-draft-count">{draftCount}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Drafts</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-emerald-500" data-testid="text-approved-count">{approvedCount}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Approved</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-blue-500" data-testid="text-filtered-count">{filteredContent.length}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Showing</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search content..."
                className="bg-muted border-border pl-9"
                data-testid="input-search-content"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36 bg-muted border-border" data-testid="select-filter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="w-36 bg-muted border-border" data-testid="select-filter-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {platformOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 bg-muted border-border" data-testid="select-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchQuery || filterType !== "all" || filterPlatform !== "all" || filterStatus !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchQuery(""); setFilterType("all"); setFilterPlatform("all"); setFilterStatus("all"); }}
                data-testid="button-clear-filters"
              >
                <X size={14} className="mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContent.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onClick={() => setSelectedContent(item)}
              onRate={(rating) => handleRate(item.id, rating)}
              onDelete={() => handleDelete(item.id)}
              onCopy={() => copyToClipboard(item.content)}
            />
          ))}
          {filteredContent.length === 0 && (
            <div className="col-span-full">
              <Card className="bg-card border-border">
                <CardContent className="p-12 text-center">
                  <Library size={48} className="mx-auto text-muted-foreground mb-4 opacity-40" />
                  <p className="text-muted-foreground" data-testid="text-empty-library">
                    {totalContent === 0
                      ? "No content generated yet. Head to Content Studio to create your first piece."
                      : "No content matches your current filters."}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <ContentCalendarView content={filteredContent} month={calendarMonth} onMonthChange={setCalendarMonth} onItemClick={setSelectedContent} />
      )}

      {selectedContent && (
        <ContentDetailDialog
          content={selectedContent}
          isOpen={!!selectedContent}
          onClose={() => { setSelectedContent(null); setEditingContent(null); }}
          onEdit={() => setEditingContent(selectedContent)}
          isEditing={editingContent?.id === selectedContent.id}
          onSave={(data) => updateMutation.mutate({ id: selectedContent.id, data })}
          onDelete={() => handleDelete(selectedContent.id)}
          onRate={(rating) => handleRate(selectedContent.id, rating)}
          onStatusChange={(status) => handleStatusChange(selectedContent.id, status)}
          onCopy={() => copyToClipboard(selectedContent.content)}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function ContentCard({ item, onClick, onRate, onDelete, onCopy }: {
  item: MarketingContent;
  onClick: () => void;
  onRate: (rating: number) => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const statusColor = item.status === "approved" ? "border-emerald-500/30 text-emerald-500"
    : item.status === "used" ? "border-blue-500/30 text-blue-500"
    : item.status === "archived" ? "border-muted-foreground/30 text-muted-foreground"
    : "border-amber-500/30 text-amber-500";

  return (
    <Card
      className="bg-card border-border cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`card-content-${item.id}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", typeColors[item.type] || "")}>
            {item.type.replace("_", " ")}
          </Badge>
          <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", platformColors[item.platform] || "")}>
            {item.platform}
          </Badge>
          <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", statusColor)}>
            {item.status}
          </Badge>
        </div>

        {item.title && (
          <h3 className="font-bold text-foreground text-sm line-clamp-1" data-testid={`text-content-title-${item.id}`}>{item.title}</h3>
        )}

        <p className="text-xs text-muted-foreground line-clamp-3" data-testid={`text-content-preview-${item.id}`}>
          {item.content?.substring(0, 200)}
        </p>

        {item.frameworkUsed && (
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Framework: <span className="text-foreground font-bold">{item.frameworkUsed}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onRate(star)}
                className="p-0.5"
                data-testid={`button-rate-${item.id}-${star}`}
              >
                <Star
                  size={12}
                  className={cn(
                    "transition-colors",
                    star <= (item.performanceRating || 0) ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCopy} data-testid={`button-copy-${item.id}`}>
              <Copy size={12} />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-rose-500" onClick={onDelete} data-testid={`button-delete-content-${item.id}`}>
              <Trash2 size={12} />
            </Button>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground font-mono">
          {item.createdAt ? format(new Date(item.createdAt), "MMM d, yyyy HH:mm") : ""}
        </div>
      </CardContent>
    </Card>
  );
}

function ContentCalendarView({ content, month, onMonthChange, onItemClick }: {
  content: MarketingContent[];
  month: Date;
  onMonthChange: (d: Date) => void;
  onItemClick: (item: MarketingContent) => void;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = monthStart.getDay();
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => i);

  const getContentForDay = (day: Date) => {
    return content.filter((item) => {
      if (!item.createdAt) return false;
      return isSameDay(new Date(item.createdAt), day);
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" data-testid="text-calendar-title">
            <Calendar size={16} className="text-emerald-500" /> {format(month, "MMMM yyyy")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => onMonthChange(subMonths(month, 1))} data-testid="button-prev-month">
              <ChevronLeft size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onMonthChange(addMonths(month, 1))} data-testid="button-next-month">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest py-2">
              {day}
            </div>
          ))}

          {paddingDays.map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[80px] p-1 rounded-md bg-muted/20" />
          ))}

          {days.map((day) => {
            const dayContent = getContentForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[80px] p-1 rounded-md border",
                  isToday ? "border-emerald-500/50 bg-emerald-500/5" : "border-border bg-muted/20",
                  dayContent.length > 0 ? "cursor-pointer" : ""
                )}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                <div className={cn(
                  "text-[10px] font-bold mb-1",
                  isToday ? "text-emerald-500" : "text-muted-foreground"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayContent.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "text-[8px] px-1 py-0.5 rounded truncate font-bold uppercase tracking-widest cursor-pointer",
                        item.type === "post" ? "bg-blue-500/10 text-blue-500" :
                        item.type === "reel_script" ? "bg-purple-500/10 text-purple-500" :
                        item.type === "blog" ? "bg-emerald-500/10 text-emerald-500" :
                        item.type === "ad_copy" ? "bg-amber-500/10 text-amber-500" :
                        "bg-cyan-500/10 text-cyan-500"
                      )}
                      onClick={() => onItemClick(item)}
                      data-testid={`calendar-content-${item.id}`}
                    >
                      {item.type.replace("_", " ")}
                    </div>
                  ))}
                  {dayContent.length > 3 && (
                    <div className="text-[8px] text-muted-foreground text-center font-bold">+{dayContent.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ContentDetailDialog({ content, isOpen, onClose, onEdit, isEditing, onSave, onDelete, onRate, onStatusChange, onCopy, isSaving }: {
  content: MarketingContent;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  isEditing: boolean;
  onSave: (data: any) => void;
  onDelete: () => void;
  onRate: (rating: number) => void;
  onStatusChange: (status: string) => void;
  onCopy: () => void;
  isSaving: boolean;
}) {
  const [editTitle, setEditTitle] = useState(content.title || "");
  const [editContent, setEditContent] = useState(content.content || "");
  const [editHook, setEditHook] = useState(content.hook || "");
  const [editCta, setEditCta] = useState(content.cta || "");
  const [editHashtags, setEditHashtags] = useState(content.hashtags || "");

  const statusColor = content.status === "approved" ? "border-emerald-500/30 text-emerald-500"
    : content.status === "used" ? "border-blue-500/30 text-blue-500"
    : content.status === "archived" ? "border-muted-foreground/30 text-muted-foreground"
    : "border-amber-500/30 text-amber-500";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap" data-testid="text-detail-title">
            <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", typeColors[content.type] || "")}>
              {content.type.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", platformColors[content.platform] || "")}>
              {content.platform}
            </Badge>
            <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", statusColor)}>
              {content.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-muted border-border"
                  data-testid="input-edit-title"
                />
              </div>
              {content.hook !== undefined && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hook</label>
                  <Input
                    value={editHook}
                    onChange={(e) => setEditHook(e.target.value)}
                    className="bg-muted border-border"
                    data-testid="input-edit-hook"
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Content</label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="bg-muted border-border font-mono text-sm"
                  rows={12}
                  data-testid="textarea-edit-content"
                />
              </div>
              {content.cta !== undefined && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Call to Action</label>
                  <Input
                    value={editCta}
                    onChange={(e) => setEditCta(e.target.value)}
                    className="bg-muted border-border"
                    data-testid="input-edit-cta"
                  />
                </div>
              )}
              {content.hashtags !== undefined && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hashtags</label>
                  <Input
                    value={editHashtags}
                    onChange={(e) => setEditHashtags(e.target.value)}
                    className="bg-muted border-border"
                    data-testid="input-edit-hashtags"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {content.title && (
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Title</label>
                  <h3 className="font-bold text-foreground text-lg mt-1" data-testid="text-content-full-title">{content.title}</h3>
                </div>
              )}
              {content.hook && (
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hook</label>
                  <p className="text-sm text-foreground mt-1 italic">{content.hook}</p>
                </div>
              )}
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Content</label>
                <div className="text-sm text-foreground mt-1 whitespace-pre-wrap bg-muted p-4 rounded-md max-h-[300px] overflow-y-auto" data-testid="text-content-full-body">
                  {content.content}
                </div>
              </div>
              {content.cta && (
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Call to Action</label>
                  <p className="text-sm text-foreground mt-1 font-bold">{content.cta}</p>
                </div>
              )}
              {content.hashtags && (
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hashtags</label>
                  <p className="text-sm text-blue-500 mt-1">{content.hashtags}</p>
                </div>
              )}
              {content.frameworkUsed && (
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Framework</label>
                  <p className="text-sm text-foreground mt-1">{content.frameworkUsed}</p>
                </div>
              )}
              {content.topicTags && content.topicTags.length > 0 && (
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Topics</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {content.topicTags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-[9px]">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Rating</div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => onRate(star)}
                    className="p-0.5"
                    data-testid={`button-detail-rate-${star}`}
                  >
                    <Star
                      size={14}
                      className={cn(
                        "transition-colors",
                        star <= (content.performanceRating || 0) ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={content.status} onValueChange={onStatusChange}>
                <SelectTrigger className="w-28 h-7 text-[10px] bg-muted border-border" data-testid="select-content-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {content.createdAt && (
            <div className="text-[10px] text-muted-foreground font-mono">
              Created: {format(new Date(content.createdAt), "MMM d, yyyy 'at' HH:mm")}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-rose-500" onClick={onDelete} data-testid="button-detail-delete">
              <Trash2 size={14} className="mr-1" /> Delete
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCopy} data-testid="button-detail-copy">
              <Copy size={14} className="mr-1" /> Copy
            </Button>
            {isEditing ? (
              <Button
                size="sm"
                className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
                onClick={() => onSave({ title: editTitle, content: editContent, hook: editHook, cta: editCta, hashtags: editHashtags })}
                disabled={isSaving}
                data-testid="button-save-edit"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onEdit} data-testid="button-edit-content">
                <Pencil size={14} className="mr-1" /> Edit
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
