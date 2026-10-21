import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { LiveKitRoom, VideoConference, RoomAudioRenderer, ControlBar } from '@livekit/components-react';
import { Shield, User, Video, Mic, Share2, ArrowLeft } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

export const DemoLabParticipantRoom: React.FC = () => {
  const { role, sessionId } = useParams<{ role: string; sessionId: string }>();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const participantRole = (role || 'trader').toUpperCase();

  useEffect(() => {
    async function fetchToken() {
      try {
        setLoading(true);
        const data = await apiClient.post('/admin/demo-lab/room/tokens', { sessionId, role: participantRole });
        if (data.traderToken || data.coachToken) {
          const selectedToken = participantRole === 'COACH' ? data.coachToken : data.traderToken;
          setToken(selectedToken);
          setServerUrl(data.serverUrl || import.meta.env.VITE_LIVEKIT_URL);
          setRoomName(data.roomName);
        } else {
          setError(data.error || 'Failed to fetch participant room token');
        }
      } catch (err: any) {
        setError(err.message || 'Connection error to token service');
      } finally {
        setLoading(false);
      }
    }

    fetchToken();
  }, [sessionId, participantRole]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070B14] text-white">
        <div className="text-center space-y-4">
          <div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm font-medium text-slate-300">
            Connecting {participantRole} to Real LiveKit Cloud Sandbox...
          </p>
        </div>
      </div>
    );
  }

  if (error || !token || !serverUrl) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070B14] text-white p-6">
        <div className="max-w-md w-full bg-[#0C1220] border border-red-500/30 rounded-xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-red-400">LiveKit Connection Notice</h2>
          <p className="text-sm text-slate-400">
            {error || 'Room tokens are not yet provisioned. Ensure the session has reached ROOM_READY or ACTIVE in Demo Lab.'}
          </p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg text-slate-200 transition"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#070B14] text-white overflow-hidden">
      {/* Top Participant Bar */}
      <header className="h-14 bg-[#0C1220] border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div
            className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
              participantRole === 'COACH'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
            }`}
          >
            {participantRole} VIEW
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Room: <span className="text-slate-200">{roomName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            SANDBOX
          </span>
          <button
            onClick={() => window.close()}
            className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Close
          </button>
        </div>
      </header>

      {/* Real LiveKit Conference Room */}
      <div className="flex-1 relative bg-[#070B14]">
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl={serverUrl}
          connect={true}
          data-lk-theme="default"
          className="h-full w-full"
        >
          <VideoConference />
          <RoomAudioRenderer />
          <ControlBar />
        </LiveKitRoom>
      </div>
    </div>
  );
};
