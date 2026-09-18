import React from 'react';
import { Search, X, Database, Sparkles } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  isSearching: boolean;
  totalResults?: number;
  source?: 'elasticsearch' | 'postgresql_fallback';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  statusFilter,
  onStatusFilterChange,
  isSearching,
  totalResults,
  source,
}) => {
  const filters = [
    { label: 'All Emails', value: '' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Rate Limited', value: 'DELAYED_RATE_LIMIT' },
    { label: 'Sent', value: 'SENT' },
    { label: 'Failed', value: 'FAILED' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        {/* Search Input Box */}
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className={`w-4 h-4 ${isSearching ? 'animate-pulse text-brand-400' : ''}`} />
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search emails by recipient, subject, or message body..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all shadow-inner"
          />
          {value && (
            <button
              onClick={() => onChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Engine Badge */}
        <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
            <Database className="w-3.5 h-3.5 text-brand-400" />
            <span className="font-medium text-slate-300">
              {source === 'postgresql_fallback' ? 'PostgreSQL Fallback' : 'Elasticsearch Index'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs / Badges */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onStatusFilterChange(f.value)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                statusFilter === f.value
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800/80 hover:bg-slate-850 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {value && totalResults !== undefined && (
          <span className="text-xs text-slate-400">
            Found <strong className="text-slate-200">{totalResults}</strong> matching result{totalResults === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  );
};
