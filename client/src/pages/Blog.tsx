import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";
import { SEO } from "@/components/SEO";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { Skeleton } from "@/components/ui/skeleton";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  category: string;
  tags?: string[];
  author?: string;
  metaTitle?: string;
  metaDescription?: string;
  published: boolean;
  publishedAt?: string;
  createdAt: string;
}

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["/api/blog/categories"],
  });

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog", selectedCategory !== "All" ? selectedCategory : undefined],
    queryFn: async () => {
      const url = selectedCategory !== "All" 
        ? `/api/blog?category=${encodeURIComponent(selectedCategory)}`
        : "/api/blog";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
  });

  const allCategories = ["All", ...categories];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title="Blog - Trading Insights & Strategy Tips | TradifyApp"
        description="Trading insights, strategy tips, and platform updates from TradifyApp. Learn disciplined trading with expert articles on prop firm challenges, MT5 analytics, and risk management."
        canonical="https://tradifyapp.com/blog"
      />
      <PublicNavbar />

      <section className="relative pt-40 pb-16">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <BookOpen size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Insights & Updates</span>
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]" data-testid="text-blog-title">
            TRADIFY <span className="text-emerald-500">BLOG</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-blog-subtitle">
            Trading insights, strategy tips, and platform updates
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-8">
        <div className="flex flex-wrap items-center gap-3" data-testid="filter-categories">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border ${
                selectedCategory === cat
                  ? "bg-emerald-500 text-slate-950 border-emerald-500"
                  : "bg-muted/50 text-muted-foreground border-border hover:border-emerald-500/20 hover:text-foreground"
              }`}
              data-testid={`button-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-background p-0">
                <Skeleton className="h-48 w-full rounded-t-2xl" />
                <div className="p-6 space-y-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24" data-testid="text-empty-state">
            <div className="h-16 w-16 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto mb-6">
              <BookOpen className="text-emerald-500" size={28} />
            </div>
            <h3 className="text-xl font-bold text-foreground uppercase tracking-widest mb-3">No articles yet</h3>
            <p className="text-muted-foreground">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="grid-blog-posts">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} data-testid={`card-blog-post-${post.id}`}>
                <article className="group rounded-2xl border border-border bg-background hover:border-emerald-500/20 transition-all duration-300 cursor-pointer h-full flex flex-col">
                  {post.coverImage ? (
                    <div className="h-48 rounded-t-2xl overflow-hidden">
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        data-testid={`img-blog-cover-${post.id}`}
                      />
                    </div>
                  ) : (
                    <div className="h-48 rounded-t-2xl bg-gradient-to-br from-emerald-500/20 via-muted to-blue-500/10 flex items-center justify-center">
                      <BookOpen className="text-emerald-500/40" size={48} />
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase tracking-widest w-fit mb-3" data-testid={`badge-category-${post.id}`}>
                      {post.category}
                    </Badge>
                    <h2 className="text-lg font-bold text-foreground uppercase tracking-tight mb-3 group-hover:text-emerald-500 transition-colors" data-testid={`text-post-title-${post.id}`}>
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1" data-testid={`text-post-excerpt-${post.id}`}>
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest" data-testid={`text-post-date-${post.id}`}>
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                          : new Date(post.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all" data-testid={`link-read-more-${post.id}`}>
                        Read More <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="py-12 border-t border-border text-center">
        <div className="flex justify-center flex-wrap gap-6 mb-4">
          <Link to="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-terms">Terms</Link>
          <Link to="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-privacy">Privacy</Link>
          <Link to="/risk-disclaimer" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-risk">Risk Disclaimer</Link>
          <Link to="/cookie-policy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-cookie">Cookie Policy</Link>
          <CookieSettingsButton />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
          &copy; 2026 TradifyApp Intelligence Systems. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
