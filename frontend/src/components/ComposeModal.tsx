import React, { useState, useRef } from 'react';
import { 
  X, 
  Send, 
  Upload, 
  FileText, 
  Check, 
  AlertCircle, 
  Clock, 
  Sliders, 
  Plus, 
  Trash2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api.ts';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'single' | 'batch'>('batch');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [singleRecipient, setSingleRecipient] = useState('');
  const [subject, setSubject] = useState('Exclusive ReachInbox Demo Update');
  const [body, setBody] = useState(
    'Hi there,\n\nThis is a scheduled email test sent via ReachInbox distributed BullMQ scheduler.\n\nBest regards,\nReachInbox Team'
  );
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState(2);
  const [hourlyRateLimit, setHourlyRateLimit] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // CSV / TXT parser extracting valid emails
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = content.match(emailRegex) || [];
      const uniqueEmails = Array.from(new Set(matches.map((m) => m.toLowerCase())));

      if (uniqueEmails.length === 0) {
        toast.error('No valid email addresses found in file');
        return;
      }

      setRecipients((prev) => Array.from(new Set([...prev, ...uniqueEmails])));
      toast.success(`Extracted ${uniqueEmails.length} valid email lead(s) from ${file.name}`);
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddSingleLead = () => {
    const email = singleRecipient.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (recipients.includes(email)) {
      toast.warning('Email already added');
      return;
    }
    setRecipients((prev) => [...prev, email]);
    setSingleRecipient('');
  };

  const removeRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalRecipients = [...recipients];
    if (mode === 'single') {
      const email = singleRecipient.trim().toLowerCase();
      if (!email) {
        toast.error('Please enter a recipient email');
        return;
      }
      finalRecipients = [email];
    } else {
      if (finalRecipients.length === 0) {
        toast.error('Please add at least one recipient lead or upload a CSV file');
        return;
      }
    }

    if (!subject.trim()) {
      toast.error('Subject line is required');
      return;
    }

    if (!body.trim()) {
      toast.error('Email body cannot be empty');
      return;
    }

    setIsSubmitting(true);

    try {
      if (finalRecipients.length === 1 && mode === 'single') {
        await api.scheduleSingle({
          recipient: finalRecipients[0],
          subject,
          body,
          scheduledAt: isScheduled && scheduleDateTime ? new Date(scheduleDateTime).toISOString() : undefined,
          delaySeconds: !isScheduled ? 0 : undefined,
        });
        toast.success(`Email scheduled successfully for ${finalRecipients[0]}`);
      } else {
        const result = await api.scheduleBatch({
          recipients: finalRecipients,
          subject,
          body,
          startTime: isScheduled && scheduleDateTime ? new Date(scheduleDateTime).toISOString() : undefined,
          delayBetweenEmailsSeconds: delayBetweenSeconds,
          hourlyLimitOverride: hourlyRateLimit,
        });
        toast.success(`Batch scheduled! ${result.data?.totalScheduled || finalRecipients.length} jobs enqueued to BullMQ.`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-brand-400" />
              <span>Compose & Schedule Outbox Leads</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enqueued to BullMQ delayed queue with distributed rate limiting
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Mode Tabs */}
          <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'batch'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CSV / Lead List Upload ({recipients.length} leads)
            </button>
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'single'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Single Recipient
            </button>
          </div>

          {/* Recipient Section */}
          {mode === 'batch' ? (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Leads & Recipients</span>
                <span className="text-brand-400 font-semibold">{recipients.length} valid email(s)</span>
              </label>

              {/* Upload Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-brand-500/50 rounded-xl p-4 text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <Upload className="w-6 h-6 text-brand-400 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-200">
                  Click or drag CSV / TXT file here
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Automatically parses and deduplicates email addresses
                </p>
              </div>

              {/* Add Single Lead manual row */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={singleRecipient}
                  onChange={(e) => setSingleRecipient(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSingleLead();
                    }
                  }}
                  placeholder="Or type lead email and press Add (e.g. alex@reachinbox.ai)"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={handleAddSingleLead}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Recipient Chips */}
              {recipients.length > 0 && (
                <div className="max-h-24 overflow-y-auto p-2 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-wrap gap-1.5">
                  {recipients.map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-brand-500/10 text-brand-300 border border-brand-500/20"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => removeRecipient(idx)}
                        className="hover:text-rose-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Recipient Email Address
              </label>
              <input
                type="email"
                required
                value={singleRecipient}
                onChange={(e) => setSingleRecipient(e.target.value)}
                placeholder="lead@company.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Subject Line
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Exciting update regarding your outbox campaign"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Email Body (Plain Text or HTML)
            </label>
            <textarea
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          {/* Scheduling & Rate Limiting Controls */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                <input
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-brand-500 focus:ring-brand-500"
                />
                <span>Schedule for Future Date & Time</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {isScheduled ? 'Scheduled Delay' : 'Send Immediately with Stagger'}
              </span>
            </div>

            {isScheduled && (
              <div>
                <input
                  type="datetime-local"
                  required={isScheduled}
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>
            )}

            {/* Delay and Throttling */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Delay Between Leads (sec)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={delayBetweenSeconds}
                  onChange={(e) => setDelayBetweenSeconds(parseInt(e.target.value, 10) || 2)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Hourly Rate Limit (emails/hr)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={hourlyRateLimit}
                  onChange={(e) => setHourlyRateLimit(parseInt(e.target.value, 10) || 5)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 shadow-glow disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scheduling Jobs...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isScheduled ? 'Schedule Queue Jobs' : 'Dispatch Emails Now'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
