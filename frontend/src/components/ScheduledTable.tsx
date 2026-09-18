import React from 'react';
import { 
  Clock, 
  AlertTriangle, 
  Trash2, 
  Loader2, 
  Mail, 
  Calendar 
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { EmailJob } from '../types/index.ts';

interface ScheduledTableProps {
  jobs: EmailJob[];
  isLoading: boolean;
  onCancel: (id: string) => void;
  cancellingId?: string | null;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  jobs,
  isLoading,
  onCancel,
  cancellingId,
}) => {
  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl border border-slate-800 p-12 text-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading scheduled jobs from queue...</p>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="glass-panel rounded-2xl border border-slate-800 p-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-slate-200">No scheduled emails in queue</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          Compose a new email or upload a CSV lead list to schedule delayed deliveries through BullMQ.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/90 overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 uppercase text-[11px] text-slate-400 tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Recipient</th>
              <th className="px-5 py-3.5">Subject</th>
              <th className="px-5 py-3.5">Scheduled For</th>
              <th className="px-5 py-3.5">Sender</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {jobs.map((job) => {
              const scheduledDate = new Date(job.scheduledAt);
              const isFuture = scheduledDate.getTime() > Date.now();
              const relativeTime = isFuture
                ? `in ${formatDistanceToNow(scheduledDate)}`
                : 'ready to send';

              return (
                <tr
                  key={job.id}
                  className="hover:bg-slate-850/50 transition-colors group"
                >
                  {/* Recipient */}
                  <td className="px-5 py-4 font-medium text-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate max-w-[200px]" title={job.recipient}>
                        {job.recipient}
                      </span>
                    </div>
                  </td>

                  {/* Subject */}
                  <td className="px-5 py-4">
                    <div className="truncate max-w-[240px] font-medium text-slate-200" title={job.subject}>
                      {job.subject}
                    </div>
                    <div className="truncate max-w-[240px] text-[11px] text-slate-500 mt-0.5">
                      {job.body.substring(0, 50)}...
                    </div>
                  </td>

                  {/* Scheduled Time */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-200">
                      <Calendar className="w-3.5 h-3.5 text-brand-400" />
                      <span>{format(scheduledDate, 'MMM d, h:mm:ss a')}</span>
                    </div>
                    <div className="text-[11px] text-brand-400/90 mt-0.5 font-medium">
                      {relativeTime}
                    </div>
                  </td>

                  {/* Sender */}
                  <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                    <span className="truncate max-w-[150px]" title={job.sender}>
                      {job.sender}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {job.status === 'DELAYED_RATE_LIMIT' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        <AlertTriangle className="w-3 h-3 text-purple-400" />
                        Rate Limit Delayed
                      </span>
                    ) : job.status === 'PROCESSING' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                        Processing
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <Clock className="w-3 h-3 text-amber-400" />
                        Pending
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onCancel(job.id)}
                      disabled={cancellingId === job.id}
                      title="Cancel this scheduled job"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-xs font-medium"
                    >
                      {cancellingId === job.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Cancel</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
