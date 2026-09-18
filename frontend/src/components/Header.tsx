import React from 'react';
import { 
  Send, 
  Slack, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  LogOut,
  RefreshCw
} from 'lucide-react';
import type { UserProfile, SlackStatus } from '../types/index.ts';

interface HeaderProps {
  user: UserProfile;
  slackStatus?: SlackStatus;
  onOpenSlackModal: () => void;
  onOpenCompose: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  onLoginDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  slackStatus,
  onOpenSlackModal,
  onOpenCompose,
  onRefresh,
  isRefreshing,
  autoRefresh,
  setAutoRefresh,
  onLoginDemo,
}) => {
  const isSlackConnected = slackStatus?.connected;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 p-0.5 shadow-glow flex items-center justify-center">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  ChronosMail
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Distributed BullMQ Queue & Rate Limiter
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Realtime Auto-refresh Indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-brand-500 focus:ring-brand-500 h-3.5 w-3.5"
                />
                <span>Live Sync (3s)</span>
              </label>
              <button
                onClick={onRefresh}
                title="Manual refresh"
                className="hover:text-white transition-colors p-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
              </button>
            </div>

            {/* Bull-Board Admin Link */}
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900/90 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
              title="Open BullMQ Live Dashboard"
            >
              <span>Queue Board</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            {/* Slack Connection Button */}
            <button
              onClick={onOpenSlackModal}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isSlackConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <Slack className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">
                {isSlackConnected ? 'Slack Connected' : 'Connect Slack'}
              </span>
              {isSlackConnected ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              )}
            </button>

            {/* User Profile / Auth */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`}
                alt={user.name || user.email}
                className="w-8 h-8 rounded-full border border-slate-700 object-cover bg-slate-800"
              />
              <div className="hidden xl:block text-left">
                <div className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
                  {user.name || 'Demo User'}
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {user.email}
                </div>
              </div>
            </div>

            {/* New Email Compose Action */}
            <button
              onClick={onOpenCompose}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition-all shadow-glow hover:scale-[1.02] active:scale-[0.98]"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Compose</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
