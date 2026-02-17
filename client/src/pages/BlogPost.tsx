import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, User, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, isError } = useQuery<BlogPost>({
    queryKey: ["/api/blog", slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/${slug}`);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PublicNavbar />
        <div className="max-w-4xl mx-auto px-6 pt-32 pb-24">
          <Skeleton className="h-4 w-24 mb-8" />
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-12 w-3/4 mb-6" />
          <Skeleton className="h-4 w-48 mb-8" />
          <Skeleton className="h-64 w-full rounded-2xl mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SEO title="Post Not Found" description="The blog post you're looking for doesn't exist." noindex />
        <PublicNavbar />
        <div className="max-w-4xl mx-auto px-6 pt-32 pb-24 text-center">
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter mb-4" data-testid="text-not-found">Post Not Found</h1>
          <p className="text-muted-foreground mb-8">The article you're looking for doesn't exist or has been removed.</p>
          <Link to="/blog">
            <Button className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs" data-testid="button-back-to-blog">
              <ArrowLeft size={14} className="mr-2" /> Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const publishedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date(post.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const tags = post.tags || [];

  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt,
    "author": { "@type": "Organization", "name": "TradifyApp" },
    "publisher": { "@type": "Organization", "name": "TradifyApp", "url": "https://tradifyapp.com" },
    "datePublished": post.publishedAt || post.createdAt,
    "dateModified": post.publishedAt || post.createdAt,
    "mainEntityOfPage": `https://tradifyapp.com/blog/${slug}`,
    ...(post.coverImage ? { "image": post.coverImage } : {})
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.excerpt}
        canonical={`https://tradifyapp.com/blog/${slug}`}
        ogType="article"
        ogImage={post.coverImage || "https://tradifyapp.com/images/tradify-promo-1.png"}
        article={{
          publishedTime: post.publishedAt || post.createdAt,
          author: post.author || "TradifyApp",
          section: post.category,
          tags: post.tags
        }}
        structuredData={articleStructuredData}
      />
      <PublicNavbar />

      <article className="max-w-4xl mx-auto px-6 pt-32 pb-24">
        <Link to="/blog" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors mb-8" data-testid="link-back-to-blog">
          <ArrowLeft size={14} /> Back to Blog
        </Link>

        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase tracking-widest mb-4" data-testid="badge-post-category">
          {post.category}
        </Badge>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase leading-tight mb-6" data-testid="text-post-title">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 mb-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-2" data-testid="text-post-date">
            <Calendar size={14} className="text-emerald-500" />
            {publishedDate}
          </span>
          {post.author && (
            <span className="flex items-center gap-2" data-testid="text-post-author">
              <User size={14} className="text-emerald-500" />
              {post.author}
            </span>
          )}
        </div>

        {post.coverImage && (
          <div className="mb-10 rounded-2xl overflow-hidden border border-border">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-auto object-cover"
              data-testid="img-post-cover"
            />
          </div>
        )}

        <div
          className="prose-content text-foreground leading-relaxed"
          data-testid="content-post-body"
        >
          <div
            className="
              [&>h1]:text-2xl [&>h1]:font-black [&>h1]:uppercase [&>h1]:tracking-tight [&>h1]:text-foreground [&>h1]:mt-10 [&>h1]:mb-4
              [&>h2]:text-xl [&>h2]:font-bold [&>h2]:uppercase [&>h2]:tracking-tight [&>h2]:text-foreground [&>h2]:mt-8 [&>h2]:mb-3
              [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-foreground [&>h3]:mt-6 [&>h3]:mb-2
              [&>p]:text-sm [&>p]:text-muted-foreground [&>p]:leading-relaxed [&>p]:mb-4
              [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-4 [&>ul]:text-sm [&>ul]:text-muted-foreground [&>ul]:space-y-1
              [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-4 [&>ol]:text-sm [&>ol]:text-muted-foreground [&>ol]:space-y-1
              [&>blockquote]:border-l-2 [&>blockquote]:border-emerald-500 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-muted-foreground [&>blockquote]:my-6
              [&>pre]:bg-muted [&>pre]:p-4 [&>pre]:rounded-xl [&>pre]:text-sm [&>pre]:overflow-x-auto [&>pre]:mb-4 [&>pre]:border [&>pre]:border-border
              [&>code]:bg-muted [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-xs [&>code]:text-emerald-400
              [&_a]:text-emerald-500 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-emerald-400
              [&>hr]:border-border [&>hr]:my-8
              [&>img]:rounded-xl [&>img]:my-6 [&>img]:border [&>img]:border-border
            "
            style={{ whiteSpace: "pre-wrap" }}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </div>

        {tags.length > 0 && (
          <div className="mt-10 pt-6 border-t border-border" data-testid="section-tags">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={14} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="bg-muted/50 border-border text-muted-foreground text-[10px] uppercase tracking-widest" data-testid={`badge-tag-${tag}`}>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-border text-center">
          <Link to="/blog">
            <Button variant="outline" className="font-bold uppercase tracking-widest text-xs" data-testid="button-bottom-back-to-blog">
              <ArrowLeft size={14} className="mr-2" /> Back to Blog
            </Button>
          </Link>
        </div>
      </article>

      <footer className="py-12 border-t border-border text-center">
        <div className="flex justify-center flex-wrap gap-6 mb-4">
          <Link to="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-terms">Terms</Link>
          <Link to="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-privacy">Privacy</Link>
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
