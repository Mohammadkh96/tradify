import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { JournalEntry, TradeReview, SessionHomework, LearningProgress, EntryType, Visibility, TradeDirection, TradeOutcome, HomeworkStatus } from '../../types';
import { BookOpen, Award, CheckSquare, PlusCircle, Search, Filter, ShieldCheck, Tag } from 'lucide-react';

export function LearningHubView() {
  const [activeTab, setActiveTab] = useState<'journal' | 'reviews' | 'homework' | 'progress'>('journal');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [reviews, setReviews] = useState<TradeReview[]>([]);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [dataIdentity, setDataIdentity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { firebaseUser, canonicalUser } = useAuthStore();
  const identityKey = firebaseUser?.uid ?? canonicalUser?.id ?? 'anonymous';
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;

  // Modal states
  const [showNewJournalModal, setShowNewJournalModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newEntryType, setNewEntryType] = useState<EntryType>(EntryType.GENERAL);
  const [newVisibility, setNewVisibility] = useState<Visibility>(Visibility.TRADER_PRIVATE);

  const [showNewReviewModal, setShowNewReviewModal] = useState(false);
  const [revInstrument, setRevInstrument] = useState('EURUSD');
  const [revDirection, setRevDirection] = useState<TradeDirection>(TradeDirection.LONG);
  const [revOutcome, setRevOutcome] = useState<TradeOutcome>(TradeOutcome.WIN);
  const [revThesis, setRevThesis] = useState('');
  const [revPnl, setRevPnl] = useState('15000'); // minor units

  const fetchData = useCallback(async () => {
    const requestedIdentity = identityKey;
    setLoading(true);
    try {
      if (activeTab === 'journal') {
        const res = await apiClient.get('/journal');
        if (identityRef.current !== requestedIdentity) return;
        setEntries(res.entries || res.data?.entries || []);
      } else if (activeTab === 'reviews') {
        const res = await apiClient.get('/trade-reviews');
        if (identityRef.current !== requestedIdentity) return;
        setReviews(res.reviews || res.data?.reviews || []);
      } else if (activeTab === 'progress') {
        const res = await apiClient.get('/learning/progress');
        if (identityRef.current !== requestedIdentity) return;
        setProgress(res.progress || res.data?.progress || null);
      }
      if (identityRef.current === requestedIdentity) setDataIdentity(requestedIdentity);
    } catch (err) {
      if (identityRef.current !== requestedIdentity) return;
      console.error('Failed to load learning data', err);
    } finally {
      if (identityRef.current === requestedIdentity) setLoading(false);
    }
  }, [activeTab, identityKey]);

  useEffect(() => {
    setEntries([]);
    setReviews([]);
    setProgress(null);
    setDataIdentity(null);
    fetchData();
  }, [fetchData]);

  async function handleCreateJournal(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiClient.post('/journal', {
        title: newTitle,
        body: newBody,
        entryType: newEntryType,
        visibility: newVisibility,
      });
      setShowNewJournalModal(false);
      setNewTitle('');
      setNewBody('');
      fetchData();
    } catch (err) {
      alert('Failed to create journal entry');
    }
  }

  async function handleCreateReview(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiClient.post('/trade-reviews', {
        instrument: revInstrument,
        direction: revDirection,
        tradeOutcome: revOutcome,
        thesis: revThesis,
        pnlMinor: parseInt(revPnl, 10),
        pnlCurrency: 'USD',
        visibility: Visibility.TRADER_PRIVATE,
      });
      setShowNewReviewModal(false);
      setRevThesis('');
      fetchData();
    } catch (err) {
      alert('Failed to create trade review');
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-xl border border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" />
            Learning Journal & Trade Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your private trading journal, manual trade reviews, and coaching homework. Completely isolated from financial settlement and public trust metrics.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'journal' && (
            <button
              onClick={() => setShowNewJournalModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> New Journal Entry
            </button>
          )}
          {activeTab === 'reviews' && (
            <button
              onClick={() => setShowNewReviewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> Log Trade Review
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('journal')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'journal' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Trading Journal
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'reviews' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Trade Reviews (Self-Reported)
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'progress' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Learning Activity & Progress
        </button>
      </div>

      {/* Content Body */}
      {loading || dataIdentity !== identityKey ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {activeTab === 'journal' && (
            <div className="grid gap-4">
              {entries.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-foreground">No journal entries yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">Record your daily reflections, session takeaways, and strategy notes.</p>
                </div>
              ) : (
                entries.map(entry => (
                  <div key={entry.id} className="bg-card p-5 rounded-xl border border-border space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-1">
                          {entry.entryType}
                        </span>
                        <h3 className="text-lg font-semibold text-foreground">{entry.title}</h3>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.entryDate).toLocaleDateString()} (v{entry.version})
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.body}</p>
                    <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 bg-muted rounded">Visibility: {entry.visibility}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <span className="font-semibold">Self-Reported Trade Review</span>: These logs are strictly for trader education and review. They have zero effect on financial settlements, ledger balances, payout holds, or public coach trust rankings.
                </div>
              </div>
              {reviews.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <Award className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-foreground">No trade reviews recorded</h3>
                  <p className="text-sm text-muted-foreground mt-1">Review your manual trades to refine your strategy.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {reviews.map(rev => (
                    <div key={rev.id} className="bg-card p-5 rounded-xl border border-border space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{rev.instrument}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${rev.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                              {rev.direction}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${rev.tradeOutcome === 'WIN' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                              {rev.tradeOutcome}
                            </span>
                          </div>
                          {rev.thesis && <p className="text-sm text-foreground mt-2"><span className="font-semibold">Thesis:</span> {rev.thesis}</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold px-2 py-1 bg-muted rounded text-muted-foreground">Self-Reported</span>
                          {rev.pnlMinor && (
                            <div className="text-sm font-bold mt-1 text-foreground">
                              PnL: ${(Number(rev.pnlMinor) / 100).toFixed(2)} {rev.pnlCurrency}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'progress' && progress && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card p-6 rounded-xl border border-border">
                <h4 className="text-sm font-medium text-muted-foreground">Sessions Completed</h4>
                <p className="text-3xl font-bold text-foreground mt-2">{progress.coachingSessionsCompleted}</p>
              </div>
              <div className="bg-card p-6 rounded-xl border border-border">
                <h4 className="text-sm font-medium text-muted-foreground">Journal Entries</h4>
                <p className="text-3xl font-bold text-foreground mt-2">{progress.journalEntriesCreated}</p>
              </div>
              <div className="bg-card p-6 rounded-xl border border-border">
                <h4 className="text-sm font-medium text-muted-foreground">Trade Reviews Logged</h4>
                <p className="text-3xl font-bold text-foreground mt-2">{progress.tradeReviewsCreated}</p>
              </div>
              <div className="bg-card p-6 rounded-xl border border-border">
                <h4 className="text-sm font-medium text-muted-foreground">Homework Completion Rate</h4>
                <p className="text-3xl font-bold text-foreground mt-2">{(progress.homeworkCompletionRate * 100).toFixed(0)}%</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* New Journal Modal */}
      {showNewJournalModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-bold text-foreground">New Journal Entry</h3>
            <form onSubmit={handleCreateJournal} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                  placeholder="e.g. Managing risk during FOMC release"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Entry Type</label>
                <select
                  value={newEntryType}
                  onChange={e => setNewEntryType(e.target.value as EntryType)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                >
                  <option value={EntryType.GENERAL}>General Note</option>
                  <option value={EntryType.DAILY_REFLECTION}>Daily Reflection</option>
                  <option value={EntryType.SESSION_REFLECTION}>Session Reflection</option>
                  <option value={EntryType.TRADE_REFLECTION}>Trade Reflection</option>
                  <option value={EntryType.STRATEGY_NOTE}>Strategy Note</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Visibility</label>
                <select
                  value={newVisibility}
                  onChange={e => setNewVisibility(e.target.value as Visibility)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                >
                  <option value={Visibility.TRADER_PRIVATE}>Trader Private</option>
                  <option value={Visibility.SHARED}>Shared with Session Coach</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reflection Body</label>
                <textarea
                  required
                  rows={5}
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                  placeholder="Write your reflection here..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewJournalModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Trade Review Modal */}
      {showNewReviewModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-bold text-foreground">Log Trade Review (Self-Reported)</h3>
            <form onSubmit={handleCreateReview} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Instrument</label>
                  <input
                    type="text"
                    required
                    value={revInstrument}
                    onChange={e => setRevInstrument(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Direction</label>
                  <select
                    value={revDirection}
                    onChange={e => setRevDirection(e.target.value as TradeDirection)}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                  >
                    <option value={TradeDirection.LONG}>Long</option>
                    <option value={TradeDirection.SHORT}>Short</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Outcome</label>
                  <select
                    value={revOutcome}
                    onChange={e => setRevOutcome(e.target.value as TradeOutcome)}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                  >
                    <option value={TradeOutcome.WIN}>Win</option>
                    <option value={TradeOutcome.LOSS}>Loss</option>
                    <option value={TradeOutcome.BREAKEVEN}>Breakeven</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">PnL ($)</label>
                  <input
                    type="number"
                    value={Number(revPnl) / 100}
                    onChange={e => setRevPnl(String(Math.round(Number(e.target.value) * 100)))}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Thesis & Lessons</label>
                <textarea
                  required
                  rows={4}
                  value={revThesis}
                  onChange={e => setRevThesis(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                  placeholder="Why did you take this trade? What did you learn?"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewReviewModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90"
                >
                  Save Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
