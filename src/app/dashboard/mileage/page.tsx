'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatDate, cn } from '@/lib/utils';
import {
  Car,
  MapPin,
  TrendingUp,
  Hash,
  Download,
  AlertCircle,
  Loader2,
  Navigation,
} from 'lucide-react';

interface MileageTrip {
  id: string;
  date: string;
  start_address: string;
  end_address: string;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  miles: number;
  purpose: string | null;
  irs_deduction: number;
  created_at: string;
}

interface MileageSummary {
  total_miles: number;
  total_deduction: number;
  trips_count: number;
  year: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          {subtext && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{subtext}</p>
          )}
        </div>
        <div className={`${accent} rounded-lg p-3`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </Card>
  );
}

function formatMiles(miles: number): string {
  return miles.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatDeduction(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function MileagePage() {
  const [trips, setTrips] = useState<MileageTrip[]>([]);
  const [summary, setSummary] = useState<MileageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - i);

  const fetchMileage = useCallback(async (year: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/mileage?year=${year}`);
      if (!res.ok) throw new Error('Failed to fetch mileage data');
      const data = await res.json();
      setTrips(data.trips || []);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMileage(selectedYear);
  }, [selectedYear, fetchMileage]);

  const handleExportCSV = async () => {
    if (trips.length === 0) return;
    setExporting(true);

    try {
      const headers = ['Date', 'From', 'To', 'Miles', 'IRS Deduction', 'Purpose'];
      const rows = trips.map((t) => [
        t.date,
        `"${(t.start_address || '').replace(/"/g, '""')}"`,
        `"${(t.end_address || '').replace(/"/g, '""')}"`,
        Number(t.miles).toFixed(2),
        Number(t.irs_deduction).toFixed(2),
        `"${(t.purpose || '').replace(/"/g, '""')}"`,
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mileage_${selectedYear}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Mileage</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Auto-tracked trips · IRS deductions at $0.70/mile
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-white/60 px-3 py-2 text-sm font-medium text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 dark:bg-slate-800 dark:text-white dark:border-slate-600"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="md"
            onClick={handleExportCSV}
            loading={exporting}
            disabled={trips.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm font-semibold text-red-900 dark:text-red-300">{error}</p>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-8 w-32 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            icon={Car}
            label={`Total Miles (${selectedYear})`}
            value={summary ? `${formatMiles(summary.total_miles)} mi` : '0.0 mi'}
            subtext={summary ? `${summary.trips_count} trip${summary.trips_count === 1 ? '' : 's'} recorded` : 'No trips yet'}
            accent="bg-blue-600"
          />
          <StatCard
            icon={TrendingUp}
            label="IRS Deduction (YTD)"
            value={summary ? formatDeduction(summary.total_deduction) : '$0.00'}
            subtext="At $0.70 per mile"
            accent="bg-green-600"
          />
          <StatCard
            icon={Hash}
            label="Total Trips"
            value={summary ? String(summary.trips_count) : '0'}
            subtext={`${selectedYear} tax year`}
            accent="bg-slate-700"
          />
        </div>
      )}

      {/* Trips Table */}
      <Card padding={false}>
        <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Trips
          </h2>
          {!loading && trips.length > 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {trips.length} trip{trips.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Navigation className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                No trips recorded for {selectedYear}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Trips are logged automatically when your phone connects and disconnects from your car Bluetooth.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 dark:border-slate-700">
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    To
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Miles
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Deduction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {trips.map((trip) => (
                  <tr
                    key={trip.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(trip.date + 'T12:00:00')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        <span className="max-w-[200px] truncate" title={trip.start_address}>
                          {trip.start_address || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                        <span className="max-w-[200px] truncate" title={trip.end_address}>
                          {trip.end_address || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-slate-900 dark:text-white">
                      {formatMiles(Number(trip.miles))} mi
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-green-600 dark:text-green-400">
                      {formatDeduction(Number(trip.irs_deduction))}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {trip.purpose || (
                        <span className="italic text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer totals row */}
        {!loading && trips.length > 0 && summary && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-900/50">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {summary.trips_count} trip{summary.trips_count === 1 ? '' : 's'} total
            </span>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <span className="text-xs text-slate-500 dark:text-slate-400">Total Miles</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatMiles(summary.total_miles)} mi
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 dark:text-slate-400">Total Deduction</span>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">
                  {formatDeduction(summary.total_deduction)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Info card */}
      <Card>
        <div className="flex gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              How automatic tracking works
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              When your phone connects to your car Bluetooth, an iOS Automation silently records your GPS start location. When you disconnect, it records the end location, calculates driving miles, and posts the trip here automatically — no tapping required.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
              IRS standard mileage rate: $0.70/mile (2024). Consult your tax advisor to confirm the rate for your tax year.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
