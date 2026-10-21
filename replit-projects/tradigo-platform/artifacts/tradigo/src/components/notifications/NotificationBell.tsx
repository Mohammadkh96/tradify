import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Check, Archive, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';

export const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    body?: string;
    actionPath?: string | null;
    createdAt: string;
    readAt?: string | null;
  }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const identityVersion = useAuthStore((state) => state.identityVersion);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    const requestedIdentityVersion = identityVersion;
    try {
      const [notificationsData, countData] = await Promise.all([
        apiClient.get('/api/notifications?pageSize=10'),
        apiClient.get('/api/notifications/unread-count'),
      ]);
      if (useAuthStore.getState().identityVersion !== requestedIdentityVersion) return;
      setNotifications(notificationsData.notifications || []);
      setUnreadCount(countData.unreadCount || 0);
    } catch (e) {
      // A request can finish after an account switch. It must not affect the
      // replacement account, including through a stale error path.
      if (useAuthStore.getState().identityVersion !== requestedIdentityVersion) return;
    }
  }, [identityVersion]);

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiClient.post(`/api/notifications/${id}/read`);
    fetchNotifications();
  };

  const handleReadAll = async () => {
    await apiClient.post('/api/notifications/read-all');
    fetchNotifications();
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiClient.post(`/api/notifications/${id}/archive`);
    fetchNotifications();
  };

  const handleItemClick = (n: any) => {
    if (!n.readAt) {
      apiClient.post(`/api/notifications/${n.id}/read`).catch(() => {});
    }
    setIsOpen(false);
    if (n.actionPath) {
      navigate(n.actionPath);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
         className="relative shrink-0 p-[8px] rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none"
      >
         <Bell className="w-[20px] h-[20px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center space-x-2">
              <button onClick={handleReadAll} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3 text-left hover:bg-accent/50 cursor-pointer transition-colors ${!n.readAt ? 'bg-accent/20' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-sm text-foreground">{n.title}</div>
                    <div className="flex items-center space-x-1">
                      {!n.readAt && (
                        <button
                          title="Mark as read"
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          className="text-muted-foreground hover:text-primary p-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        title="Archive"
                        onClick={(e) => handleArchive(n.id, e)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
