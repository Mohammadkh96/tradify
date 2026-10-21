import React, { useState, useEffect } from 'react';
import { Heart, Search, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { CoachCard } from '../../components/marketplace/CoachCard';
import { CoachCardSkeleton } from '../../components/ui/Skeleton';
import { CoachMarketplaceDTO } from '../../types';
import { apiClient } from '../../lib/apiClient';

export const FavoritesView = () => {
  const [favorites, setFavorites] = useState<CoachMarketplaceDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      // First get the favorite IDs
       const favsData = await apiClient.get('/api/marketplace/favorites');
      
       const favoriteItems = Array.isArray(favsData) ? favsData : (favsData?.favorites || []);
       if (favoriteItems.length > 0) {
        // Fetch full profiles for each favorite
        const profiles = await Promise.all(
          favoriteItems.map(async (f: any) => {
            try {
              return await apiClient.get(`/api/marketplace/coaches/${f.coachUserId}`);
            } catch {
              return null;
            }
          })
        );
        setFavorites(profiles.filter(p => p !== null));
      } else {
        setFavorites([]);
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleFavoriteToggle = async (id: string, isFavorited: boolean) => {
    if (!isFavorited) {
      // Remove from UI immediately for better UX
      setFavorites(prev => prev.filter(c => c.id !== id));
      try {
         await apiClient.delete(`/api/marketplace/coaches/${id}/favorite`);
      } catch (err) {
        // If it failed, we'd ideally refetch, but keeping it simple
        console.error('Unfavorite failed:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Favorite Coaches</h1>
        <p className="text-muted-foreground mt-1">Quick access to mentors you trust.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <CoachCardSkeleton key={i} />
          ))}
        </div>
      ) : favorites.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favorites.map((coach) => (
            <CoachCard key={coach.id} coach={coach} onFavoriteToggle={handleFavoriteToggle} />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl py-20 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">No favorites yet</h3>
          <p className="text-muted-foreground mt-2 max-w-md">Browse the marketplace and heart the coaches you want to save for later.</p>
          <Link 
            to="/app/coaches"
            className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-md transition-colors font-bold flex items-center"
          >
            <Search className="w-4 h-4 mr-2" />
            Explore Marketplace
          </Link>
        </div>
      )}
    </div>
  );
};
