import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  Send, 
  Search, 
  Sparkles, 
  RefreshCw, 
  AlertTriangle,
  Mail,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { Header } from './components/Header.tsx';
import { StatsCards } from './components/StatsCards.tsx';
import { ScheduledTable } from './components/ScheduledTable.tsx';
import { SentTable } from './components/SentTable.tsx';
import { SearchBar } from './components/SearchBar.tsx';
import { ComposeModal } from './components/ComposeModal.tsx';
import { SlackModal } from './components/SlackModal.tsx';
import { api } from './services/api.ts';
import type { 
  EmailJob, 
  DashboardStats, 
  SearchResponse, 
  SlackStatus, 
  UserProfile 
} from './types/index.ts';

export const App: React.FC = () => {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);

  // User Profile
  const [user, setUser] = useState<UserProfile>({
    id: 'demo-user-id',
    email: 'demo@reachinbox.ai',
    name: 'ReachInbox Demo User',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=reachinbox',
  });

  // Data State
  const [scheduledJobs, setScheduledJobs] = useState<EmailJob[]>([]);
  const [sentJobs, setSentJobs] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<DashboardStats | undefined>(undefined);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | undefined>(undefined);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Loading States
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);
  const [isLoadingSent, setIsLoadingSent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResettingLimit, setIsResettingLimit] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch Dashboard Stats & Slack Status
  const fetchOverview = useCallback(async () => {
    try {
      const [statsData, slackData] = await Promise.all([
        api.getStats(user.email),
        api.getSlackStatus(),
      ]);
      setStats(statsData);
      setSlackStatus(slackData);
    } catch (err: any) {
      console.error('Failed to load overview data:', err);
    }
  }, [user.email]);

  // Fetch Scheduled Emails
  const fetchScheduled = useCallback(async () => {
    setIsLoadingScheduled(true);
    try {
      const data = await api.getScheduled(1, 100);
      setScheduledJobs(data.items);
    } catch (err: any) {
      console.error('Failed to load scheduled emails:', err);
    } finally {
      setIsLoadingScheduled(false);
    }
  }, []);

  // Fetch Sent Emails
  const fetchSent = useCallback(async () => {
    setIsLoadingSent(true);
    try {
      const data = await api.getSent(1, 100);
      setSentJobs(data.items);
    } catch (err: any) {
      console.error('Failed to load sent emails:', err);
    } finally {
      setIsLoadingSent(false);
    }
  }, []);

  // Refresh all data
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchOverview(), fetchScheduled(), fetchSent()]);
    setIsRefreshing(false);
  };

  // Initial Load
  useEffect(() => {
    handleRefreshAll();
  }, []);

  // Auto-polling interval for live queue observation
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchOverview();
      if (activeTab === 'scheduled') {
        fetchScheduled();
      } else {
        fetchSent();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, fetchOverview, fetchScheduled, fetchSent]);

  // Debounced Elasticsearch Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.searchEmails(searchQuery.trim(), searchFilter || undefined);
        setSearchResults(res);
      } catch (err: any) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchFilter]);

  // Cancel email job
  const handleCancelEmail = async (id: string) => {
    setCancellingId(id);
    try {
      await api.cancelEmail(id);
      toast.success('Email job successfully cancelled and removed from queue');
      fetchScheduled();
      fetchOverview();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to cancel job');
    } finally {
      setCancellingId(null);
    }
  };

  // Reset rate limit for testing
  const handleResetRateLimit = async () => {
    setIsResettingLimit(true);
    try {
      await api.resetRateLimit(user.email);
      toast.success('Hourly rate limit counter reset for testing');
      fetchOverview();
    } catch (err: any) {
      toast.error('Failed to reset rate limit');
    } finally {
      setIsResettingLimit(false);
    }
  };

  const isSearchActive = Boolean(searchQuery.trim());

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header */}
      <Header
        user={user}
        slackStatus={slackStatus}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        onOpenCompose={() => setIsComposeOpen(true)}
        onRefresh={handleRefreshAll}
        isRefreshing={isRefreshing}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        onLoginDemo={() => {}}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Banner with Distributed Architecture Info */}
        <div className="relative rounded-2xl p-6 overflow-hidden border border-brand-500/20 bg-gradient-to-r from-brand-950/60 via-slate-900 to-indigo-950/60">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-2">
                <Zap className="w-3.5 h-3.5 text-brand-400" />
                <span>Zero-Cron Architecture • Native BullMQ Delay Scheduling</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                High-Reliability Email Job Scheduler
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
                PostgreSQL persistence with idempotency, Redis atomic hourly sliding counters, resilient crash-recovery synchronization, and Elasticsearch fulltext search.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsComposeOpen(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 shadow-glow transition-all flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Schedule Batch Leads</span>
              </button>
            </div>
          </div>
        </div>

        {/* Real-time Stats Cards */}
        <StatsCards
          stats={stats}
          onResetRateLimit={handleResetRateLimit}
          isResetting={isResettingLimit}
        />

        {/* Search Bar */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800/90">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            statusFilter={searchFilter}
            onStatusFilterChange={setSearchFilter}
            isSearching={isSearching}
            totalResults={searchResults?.total}
            source={searchResults?.source}
          />
        </div>

        {/* Tab Switcher & Table Container */}
        <div className="space-y-4">
          {!isSearchActive ? (
            <>
              {/* Tab Navigation */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('scheduled')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'scheduled'
                        ? 'bg-brand-600 text-white shadow-glow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Scheduled Queue</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/60 text-slate-300">
                      {scheduledJobs.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('sent')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'sent'
                        ? 'bg-brand-600 text-white shadow-glow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>Sent History & Ethereal Previews</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/60 text-slate-300">
                      {sentJobs.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Active Tab Table */}
              {activeTab === 'scheduled' ? (
                <ScheduledTable
                  jobs={scheduledJobs}
                  isLoading={isLoadingScheduled}
                  onCancel={handleCancelEmail}
                  cancellingId={cancellingId}
                />
              ) : (
                <SentTable jobs={sentJobs} isLoading={isLoadingSent} />
              )}
            </>
          ) : (
            /* Elasticsearch Search Results Table */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-brand-400" />
                  <span>
                    Search Results ({searchResults?.total ?? 0} matches via {searchResults?.source || 'Elasticsearch'})
                  </span>
                </h3>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                >
                  Exit Search Mode
                </button>
              </div>

              {searchResults?.items && searchResults.items.length > 0 ? (
                <div className="space-y-4">
                  <SentTable jobs={searchResults.items} isLoading={isSearching} />
                </div>
              ) : (
                <div className="glass-panel rounded-2xl border border-slate-800 p-12 text-center">
                  <p className="text-sm text-slate-400">
                    No emails matching query "{searchQuery}".
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Compose & Schedule Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          handleRefreshAll();
          setActiveTab('scheduled');
        }}
      />

      {/* Slack Webhook / OAuth Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        status={slackStatus}
        onRefreshStatus={fetchOverview}
      />
    </div>
  );
};
export default App;
