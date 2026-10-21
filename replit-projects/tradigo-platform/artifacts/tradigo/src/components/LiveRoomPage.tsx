import React, { useEffect, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router";
import { ArrowLeft, Loader2, Users, SquareCheckBig } from "lucide-react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { apiClient } from "../lib/apiClient";
import { useAuthStore } from "../stores/authStore";
import { Button } from "./ui/Button";
import { TradigoMark } from "./trading/TradigoLogo";

interface SessionInfo {
  id: string;
  topic?: string;
  durationMinutes: number;
  sessionStartedAt?: string;
  status: string;
}

export default function LiveRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { canonicalUser } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const sessionBasePath = location.pathname.startsWith("/preview/coach")
    ? "/preview/coach"
    : location.pathname.startsWith("/preview")
      ? "/preview"
      : canonicalUser?.role === "COACH"
        ? "/coach"
        : "/app";
  const returnPath = sessionId ? `${sessionBasePath}/sessions/${sessionId}` : sessionBasePath;

  useEffect(() => {
    async function loadData() {
      try {
        const [tokenRes, sessionRes] = await Promise.all([
          apiClient.post(`/api/sessions/${sessionId}/room/token`),
          apiClient.get(`/api/sessions/${sessionId}`)
        ]);

        if (tokenRes.success) {
          setToken(tokenRes.token);
          setServerUrl(tokenRes.serverUrl);
        } else {
          setError("The consultation room is not ready yet.");
        }

        if (sessionRes.session) {
          setSession(sessionRes.session);
        }
      } catch (err: any) {
        setError(err.message || "Unable to connect to the consultation room.");
      }
    }
    loadData();
  }, [sessionId]);

  useEffect(() => {
    if (token && serverUrl && sessionId) {
      // Mark as joined
      apiClient.post(`/api/sessions/${sessionId}/attendance`, { eventType: 'JOINED' }).catch(() => {});

      return () => {
        // Mark as left on unmount
        apiClient.post(`/api/sessions/${sessionId}/attendance`, { eventType: 'LEFT' }).catch(() => {});
      };
    }
  }, [token, serverUrl, sessionId]);

  useEffect(() => {
    if (session?.sessionStartedAt) {
      const interval = setInterval(() => {
        const start = new Date(session.sessionStartedAt!).getTime();
        const now = Date.now();
        setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [session?.sessionStartedAt]);

  const handleEndSession = async () => {
    if (!sessionId) return;
    if (!window.confirm('End this consultation for both participants and finalize the metered charge?')) return;
    setActionError(null);
    try {
      await apiClient.post(`/api/sessions/${sessionId}/complete`, { reason: 'Consultation concluded from live room', confirm: true });
      navigate(returnPath);
    } catch (e: any) {
      setActionError(e.message || 'The consultation could not be finalized. You can remain in the room and try again.');
    }
  };

  const handleLeaveTemporarily = () => {
    navigate(returnPath);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="tradigo-room-layout">
        <header className="tradigo-room-header">
          <button
            onClick={handleLeaveTemporarily}
            className="tradigo-room-back"
            data-testid="button-return-to-session"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Ledger
          </button>
        </header>
        <div className="tradigo-room-state" data-testid="status-room-error">
          <div className="tradigo-room-state-icon text-destructive">
            <Users className="w-12 h-12" />
          </div>
          <h1 className="tradigo-room-state-title">Unable to Connect</h1>
          <p className="tradigo-room-state-desc">{error}</p>
          <button onClick={handleLeaveTemporarily} className="tradigo-room-primary-btn">
            Return to Ledger
          </button>
        </div>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="tradigo-room-layout">
        <header className="tradigo-room-header">
          <button
            onClick={handleLeaveTemporarily}
            className="tradigo-room-back"
            data-testid="button-return-to-session"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Ledger
          </button>
        </header>
        <div className="tradigo-room-state" data-testid="status-room-loading">
          <div className="relative mb-6" aria-hidden="true">
            <TradigoMark className="tradigo-room-state-icon !mb-0 text-[var(--room-blue)]" />
            <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin text-[var(--room-coral)]" />
          </div>
          <h1 className="tradigo-room-state-title">Provisioning Room</h1>
          <p className="tradigo-room-state-desc">
            Establishing a secure line for your professional consultation...
          </p>
        </div>
      </div>
    );
  }

  const durationRemainingSeconds = session ? (session.durationMinutes * 60) - elapsedSeconds : 0;
  const isOvertime = durationRemainingSeconds < 0;

  return (
    <div className="tradigo-room-layout">
      <header className="tradigo-room-header">
        <div className="flex items-center gap-4">
          <div className="tradigo-room-info">
            <div
              className="tradigo-room-badge"
              data-testid="status-participant-context"
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Professional Consultation</span>
              <span className="sm:hidden">Consultation</span>
            </div>

            {session?.sessionStartedAt && (
              <div className="tradigo-room-badge tradigo-room-timer" style={{ color: isOvertime ? 'var(--room-danger)' : 'inherit', borderColor: isOvertime ? 'var(--room-danger-bg)' : 'inherit' }}>
                {isOvertime ? '+' : ''}{formatTime(Math.abs(durationRemainingSeconds))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeaveTemporarily}
            className="hidden sm:flex border-border text-foreground hover:bg-secondary"
          >
            Leave Temporarily
          </Button>
          <Button
            size="sm"
            onClick={handleEndSession}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2"
          >
            <SquareCheckBig className="w-4 h-4" />
            <span className="hidden sm:inline">End Consultation</span>
            <span className="sm:hidden">End</span>
          </Button>
        </div>
      </header>

      <main className="tradigo-room-stage">
        {actionError && (
          <div role="alert" className="mx-auto mb-3 w-full max-w-3xl rounded-xl border border-red-500/30 bg-red-950/70 px-4 py-3 text-sm text-red-100">
            {actionError}
          </div>
        )}
        <div
          className="tradigo-room-video-container"
          data-testid="stage-livekit-conference"
        >
          <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={serverUrl}
            connect={true}
            className="lk-room-wrapper"
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      </main>
    </div>
  );
}
