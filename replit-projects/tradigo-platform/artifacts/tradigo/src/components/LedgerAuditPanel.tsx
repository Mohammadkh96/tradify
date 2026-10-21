import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Activity,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Key,
  RefreshCw,
} from 'lucide-react';
import { AuditLog, LedgerEntry } from '../types/index.js';

export const LedgerAuditPanel: React.FC = () => {
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'ledger' | 'audit'>('ledger');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ledger');
      const data = await res.json();
      if (data.ledgerEntries) setLedgerEntries(data.ledgerEntries);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
    } catch (err) {
      console.error('Failed to load ledger:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 flex items-center justify-between shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Financial Integrity & Immutability</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Double-Entry Ledger & Audit Trail</h1>
          <p className="text-xs text-slate-300">
            Integer minor unit transactions, idempotent escrow captures, and strict server-side audit logs.
          </p>
        </div>

        <button
          id="refresh-ledger-btn"
          onClick={fetchLedger}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800">
        <button
          id="tab-view-ledger-entries"
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'ledger'
              ? 'border-blue-500 text-blue-400 bg-slate-900/40 rounded-t'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Immutable Ledger ({ledgerEntries.length})</span>
        </button>

        <button
          id="tab-view-audit-logs"
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-blue-500 text-blue-400 bg-slate-900/40 rounded-t'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Security Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* Table 1: Immutable Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Account Type</th>
                  <th className="px-4 py-3">Amount (USD)</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Idempotency Key</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {ledgerEntries.map((entry) => {
                  const isCredit = entry.direction === 'CREDIT';
                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 font-sans font-semibold text-white">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                          {entry.accountType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-sm">
                        ${(entry.amountCents / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold inline-flex items-center space-x-1 ${
                            isCredit
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          <span>{entry.direction}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px] truncate max-w-[140px]">
                        {entry.idempotencyKey}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-300 text-xs">{entry.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table 2: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Reason / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-blue-400 font-semibold">{log.actorId}</td>
                    <td className="px-4 py-3">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold text-white border border-slate-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{log.entityType} ({log.entityId.substring(0, 10)})</td>
                    <td className="px-4 py-3 font-sans text-slate-300 text-xs">{log.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
