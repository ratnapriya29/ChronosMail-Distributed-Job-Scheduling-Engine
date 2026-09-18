import React from 'react';
import { 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Loader2, 
  Mail, 
  Calendar 
} from 'lucide-react';
import { format } from 'date-fns';
import type { EmailJob } from '../types/index.ts';

interface SentTableProps {
  jobs: EmailJob[];
  isLoading: boolean;
}

export const SentTable: React.FC<SentTableProps> = ({
  jobs,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl border border-slate-800 p-12 text-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading sent history...</p>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="glass-panel rounded-2xl border border-slate-800 p-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-3">
          <Mail className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-slate-200">No sent emails recorded yet</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          When BullMQ worker delivers emails via Ethereal SMTP, they will appear here with live preview links.
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
              <th className="px-5 py-3.5">Sent At</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {jobs.map((job) => {
              const sentDate = job.sentAt ? new Date(job.sentAt) : new Date(job.updatedAt);

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
                    <div className="truncate max-w-[260px] font-medium text-slate-200" title={job.subject}>
                      {job.subject}
                    </div>
                    <div className="truncate max-w-[260px] text-[11px] text-slate-500 mt-0.5">
                      {job.body.substring(0, 60)}...
                    </div>
                  </td>

                  {/* Sent Date */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-200">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{format(sentDate, 'MMM d, yyyy h:mm:ss a')}</span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {job.status === 'SENT' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        Delivered
                      </span>
                    ) : (
                      <span 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20"
                        title={job.errorMessage || 'Send failure'}
                      >
                        <XCircle className="w-3 h-3 text-rose-400" />
                        Failed
                      </span>
                    )}
                  </td>

                  {/* Ethereal Preview Button */}
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    {job.etherealPreviewUrl ? (
                      <a
                        href={job.etherealPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all glow-hover"
                      >
                        <span>View in Ethereal</span>
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                      </a>
                    ) : (
                      <span className="text-slate-500 text-xs italic">
                        No preview
                      </span>
                    )}
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
