import React, { useState, useEffect } from 'react';
import { 
  X, 
  Slack, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Trash2, 
  ExternalLink,
  Loader2 
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api.ts';
import type { SlackStatus } from '../types/index.ts';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  status?: SlackStatus;
  onRefreshStatus: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  status,
  onRefreshStatus,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#reachinbox-alerts');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const isConnected = status?.connected;

  useEffect(() => {
    if (status?.data?.channel) {
      setChannel(status.data.channel);
    }
  }, [status]);

  if (!isOpen) return null;

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim() || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      toast.error('Please enter a valid Slack incoming webhook URL (https://hooks.slack.com/...)');
      return;
    }

    setIsSaving(true);
    try {
      await api.connectSlackWebhook(webhookUrl.trim(), channel.trim());
      toast.success('Slack webhook connected and verified with a test notification!');
      onRefreshStatus();
      setWebhookUrl('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to connect Slack webhook');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestAlert = async () => {
    setIsTesting(true);
    try {
      await api.testSlackAlert();
      toast.success('Test alert successfully delivered to your Slack channel!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to dispatch Slack test alert');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await api.disconnectSlack();
      toast.success('Slack disconnected');
      onRefreshStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A154B]/30 border border-[#4A154B] flex items-center justify-center text-[#E01E5A]">
              <Slack className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Slack Real-time Alerts</h3>
              <p className="text-xs text-slate-400">
                Hourly rate-limit notifications sent to your channel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Status Box */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400" />
            )}
            <div>
              <div className="text-xs font-semibold text-slate-200">
                {isConnected ? 'Slack Connected & Listening' : 'No Slack Channel Connected'}
              </div>
              <div className="text-[11px] text-slate-400">
                {isConnected
                  ? `Alerts destination: ${status?.data?.channel || '#reachinbox-alerts'}`
                  : 'Rate-limit alerts will fail gracefully without errors'}
              </div>
            </div>
          </div>

          {isConnected && (
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-xs text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          )}
        </div>

        {/* Webhook Form */}
        <form onSubmit={handleSaveWebhook} className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Incoming Webhook URL
            </label>
            <input
              type="url"
              required
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Created via Slack Apps &gt; Incoming Webhooks.
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Channel Identifier
            </label>
            <input
              type="text"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="#reachinbox-alerts"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-2">
            {isConnected ? (
              <button
                type="button"
                onClick={handleTestAlert}
                disabled={isTesting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
              >
                {isTesting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send Test Alert</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 shadow-glow transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Save & Connect</span>
              )}
            </button>
          </div>
        </form>

        {/* OAuth option */}
        <div className="mt-4 pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500 mb-2">
            Alternatively, connect using Slack OAuth app:
          </p>
          <a
            href="http://localhost:5000/api/slack/oauth/start"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            <Slack className="w-3.5 h-3.5 text-emerald-400" />
            <span>Connect with Slack OAuth</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
        </div>
      </div>
    </div>
  );
};
