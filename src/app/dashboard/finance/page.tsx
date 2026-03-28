'use client';

import { useState, useRef } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  Upload,
  Trash2,
  Search,
  Download,
  Link2,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

// Types
interface Statement {
  id: string;
  filename: string;
  upload_date: string;
  file_type: 'pdf' | 'csv';
  parsed: boolean;
}

interface Transaction {
  id: string;
  statement_id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  matched_invoice_id: string | null;
  category: string;
}

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

// Mock data
const mockStatements: Statement[] = [];
const mockTransactions: Transaction[] = [];
const mockMonthlyData: MonthlyData[] = [];
const mockUnmatchedInvoices: Array<{ id: string; number: string; amount: number }> = [];

export default function FinancePage() {
  const [statements, setStatements] = useState<Statement[]>(mockStatements);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'credit' | 'debit'>('all');
  const [showMatching, setShowMatching] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Calculate summary stats
  const currentMonthTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    const now = new Date();
    return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
  });

  const income = currentMonthTransactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = currentMonthTransactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const bankBalance = transactions.reduce((sum, t) => sum + t.amount, 0);

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.date.includes(searchQuery);
    const matchesType = selectedType === 'all' || t.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Sort by date descending
  const sortedTransactions = [...filteredTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // File upload handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach(file => {
      if (file.type === 'application/pdf' || file.type === 'text/csv') {
        const newStatement: Statement = {
          id: Math.random().toString(36).substr(2, 9),
          filename: file.name,
          upload_date: new Date().toISOString().split('T')[0],
          file_type: file.type === 'application/pdf' ? 'pdf' : 'csv',
          parsed: true,
        };
        setStatements(prev => [newStatement, ...prev]);
      }
    });
  };

  const deleteStatement = (id: string) => {
    setStatements(prev => prev.filter(s => s.id !== id));
    setTransactions(prev => prev.filter(t => t.statement_id !== id));
  };

  const handleMatchInvoice = (transactionId: string, invoiceId: string) => {
    setTransactions(prev =>
      prev.map(t =>
        t.id === transactionId ? { ...t, matched_invoice_id: invoiceId } : t
      )
    );
    setShowMatching(null);
  };

  const clearMatching = (transactionId: string) => {
    setTransactions(prev =>
      prev.map(t =>
        t.id === transactionId ? { ...t, matched_invoice_id: null } : t
      )
    );
  };

  // Calculate max values for chart
  const maxValue = Math.max(
    1,
    ...mockMonthlyData.map(d => Math.max(d.income, d.expenses))
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Finance</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Upload bank statements and track transactions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Bank Balance</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(bankBalance)}
            </p>
          </div>
        </Card>

        <Card>
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Income This Month
            </p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(income)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentMonthTransactions.filter(t => t.type === 'credit').length} transactions
            </p>
          </div>
        </Card>

        <Card>
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Expenses This Month
            </p>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(expenses)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentMonthTransactions.filter(t => t.type === 'debit').length} transactions
            </p>
          </div>
        </Card>
      </div>

      {/* Upload Section */}
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Upload Bank Statements
            </h2>

            {/* Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
                dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Drop your bank statement here or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      click to browse
                    </button>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Supports PDF and CSV files
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Uploaded Statements */}
          {statements.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Recent Statements
              </h3>
              <div className="space-y-2">
                {statements.map(statement => (
                  <div
                    key={statement.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-slate-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {statement.filename}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(statement.upload_date)} ·{' '}
                          <span
                            className={cn(
                              'font-medium',
                              statement.parsed
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-amber-600 dark:text-amber-400'
                            )}
                          >
                            {statement.parsed ? 'Parsed' : 'Pending'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteStatement(statement.id)}
                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      aria-label="Delete statement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Transactions Table */}
      <Card padding={false}>
        <div className="space-y-4 p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Transactions</h2>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              placeholder="Search by date or description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              className="flex-1"
            />

            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value as 'all' | 'credit' | 'debit')}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
            >
              <option value="all">All Types</option>
              <option value="credit">Income</option>
              <option value="debit">Expenses</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 dark:border-slate-700">
              <tr className="bg-slate-50 dark:bg-slate-900/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 dark:text-white">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 dark:text-white">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 dark:text-white">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 dark:text-white">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900 dark:text-white">
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {sortedTransactions.length > 0 ? (
                sortedTransactions.map(transaction => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                      {transaction.description}
                    </td>
                    <td
                      className={cn(
                        'px-6 py-4 text-sm font-semibold',
                        transaction.type === 'credit'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {transaction.type === 'credit' ? '+' : '-'}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {transaction.category}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {transaction.type === 'credit' ? (
                        <div className="relative">
                          {transaction.matched_invoice_id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-900 dark:text-white font-medium">
                                {
                                  mockUnmatchedInvoices.find(
                                    inv => inv.id === transaction.matched_invoice_id
                                  )?.number
                                }
                              </span>
                              <button
                                onClick={() => clearMatching(transaction.id)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                aria-label="Clear matching"
                              >
                                <Link2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setShowMatching(
                                    showMatching === transaction.id ? null : transaction.id
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              >
                                Match
                                <ChevronDown className="w-3 h-3" />
                              </button>

                              {showMatching === transaction.id && (
                                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 min-w-max">
                                  {mockUnmatchedInvoices.map(invoice => (
                                    <button
                                      key={invoice.id}
                                      onClick={() =>
                                        handleMatchInvoice(transaction.id, invoice.id)
                                      }
                                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                                    >
                                      <div className="font-medium">{invoice.number}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {formatCurrency(invoice.amount)}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No transactions found
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Monthly Summary Chart */}
      <Card>
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Monthly Summary</h2>

          <div className="space-y-4">
            {mockMonthlyData.map(data => (
              <div key={data.month}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {data.month}
                  </span>
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-x-3">
                    <span className="inline-block">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                      {formatCurrency(data.income)}
                    </span>
                    <span className="inline-block">
                      <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                      {formatCurrency(data.expenses)}
                    </span>
                  </div>
                </div>

                <div className="flex items-end gap-2 h-8">
                  {/* Income Bar */}
                  <div className="flex-1 bg-green-100 dark:bg-green-900/30 rounded">
                    <div
                      className="bg-green-500 rounded h-full"
                      style={{ height: `${(data.income / maxValue) * 100}%` }}
                    ></div>
                  </div>

                  {/* Expenses Bar */}
                  <div className="flex-1 bg-red-100 dark:bg-red-900/30 rounded">
                    <div
                      className="bg-red-500 rounded h-full"
                      style={{ height: `${(data.expenses / maxValue) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
