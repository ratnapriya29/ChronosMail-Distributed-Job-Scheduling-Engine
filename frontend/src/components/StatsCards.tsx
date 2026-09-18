import React from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Gauge, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import type { DashboardStats } from '../types/index.ts';

interface StatsCardsProps {
  stats?: DashboardStats;
  onResetRateLimit: () => void;
  isResetting: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  stats,
  onResetRateLimit,
  isResetting,
}) => {
  const currentCount = stats?.rateLimit?.count || 0;
  const limit = stats?.rateLimit?.limit || 5;
  const remaining = stats?.rateLimit?.remaining || 0;
  const percentage = Math.min(100, Math.round((currentCount / limit) * 100));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Scheduled Emails */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/90 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Scheduled (Pending)</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {stats?.scheduled ?? 0}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
          <span>BullMQ delayed set</span>
        </p>
      </div>

      {/* 2. Sent Emails */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/90 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Delivered (Sent)</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {stats?.sent ?? 0}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
          <span>Sent via Ethereal SMTP</span>
        </p>
      </div>

      {/* 3. Delayed by Rate Limit */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/90 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Delayed (Rate Limit)</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {stats?.delayedRateLimit ?? 0}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-purple-400/80 mt-3">
          Rescheduled to next window
        </p>
      </div>

      {/* 4. Hourly Rate Limit Window */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/90 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-slate-400">Hourly Rate Limit</p>
              <button
                onClick={onResetRateLimit}
                disabled={isResetting}
                title="Reset Redis rate limit counter for testing"
                className="text-slate-500 hover:text-brand-400 transition-colors p-0.5"
              >
                <RotateCcw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <h3 className="text-2xl font-bold text-white mt-1 flex items-baseline gap-1">
              <span>{currentCount}</span>
              <span className="text-xs text-slate-400 font-normal">/ {limit} hr</span>
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <Gauge className="w-5 h-5" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                percentage >= 100
                  ? 'bg-rose-500'
                  : percentage >= 80
                  ? 'bg-amber-500'
                  : 'bg-brand-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>{remaining} slot(s) remaining</span>
            <span>{percentage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
