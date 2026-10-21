import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Users, FolderKanban, MessageSquareWarning, FileText, Lock, Unlock, AlertTriangle, CheckCircle, Search, RefreshCw, Eye, Plus 
} from 'lucide-react';

interface AdminMetrics {
  openComplianceCasesCount: number;
  pendingCoachApplicationsCount: number;
  flaggedReviewsCount: number;
  suspendedUsersCount: number;
  activePayoutHoldsCount: number;
  openReportsCount?: number;
  activeDisputesCount?: number;
  paymentExceptionsCount?: number;
}

export type AdminControlPlaneTab = 'dashboard' | 'users' | 'compliance' | 'moderation' | 'audit';

const previewMetrics: AdminMetrics = {
  openComplianceCasesCount: 3,
  pendingCoachApplicationsCount: 5,
  flaggedReviewsCount: 2,
  suspendedUsersCount: 1,
  activePayoutHoldsCount: 2,
};

const previewUsers = [
  { id: 'usr_maya_chen', displayName: 'Maya Chen', email: 'maya@demo.tradigo.app', role: 'COACH', status: 'ACTIVE' },
  { id: 'usr_omar_haddad', displayName: 'Omar Haddad', email: 'omar@demo.tradigo.app', role: 'COACH', status: 'ACTIVE' },
  { id: 'usr_lucas_meyer', displayName: 'Lucas Meyer', email: 'lucas@demo.tradigo.app', role: 'TRADER', status: 'ACTIVE' },
  { id: 'usr_review_hold', displayName: 'Review Hold Account', email: 'review-hold@demo.tradigo.app', role: 'TRADER', status: 'SUSPENDED' },
];

const previewComplianceCases = [
  { id: 'case_2048', caseType: 'PAYOUT_REVIEW', priority: 'HIGH', status: 'OPEN', summary: 'Coach payout held while identity review is completed.' },
  { id: 'case_2047', caseType: 'SESSION_CONDUCT', priority: 'NORMAL', status: 'IN_REVIEW', summary: 'Participant report requires a neutral session review.' },
  { id: 'case_2045', caseType: 'ACCOUNT_SECURITY', priority: 'CRITICAL', status: 'OPEN', summary: 'Unusual sign-in pattern detected across two devices.' },
];

const previewFlaggedReviews = [
  { id: 'review_81', coachName: 'Maya Chen', overall_rating: 2, review_text: 'The review included a claim that needs moderator context.', moderation_status: 'PENDING' },
  { id: 'review_79', coachName: 'Omar Haddad', overall_rating: 1, review_text: 'Participant report attached for review.', moderation_status: 'ESCALATED' },
];

const previewAuditLogs = [
  { id: 'audit_91', occurredAt: '2026-08-26T07:10:00.000Z', action: 'PAYOUT_HOLD_PLACED', targetType: 'PAYOUT', targetId: 'pay_3108', reason: 'Awaiting identity review' },
  { id: 'audit_90', occurredAt: '2026-08-26T06:55:00.000Z', action: 'REVIEW_ESCALATED', targetType: 'REVIEW', targetId: 'review_79', reason: 'Possible guarantee language' },
  { id: 'audit_89', occurredAt: '2026-08-26T06:40:00.000Z', action: 'USER_SUSPENDED', targetType: 'USER', targetId: 'usr_review_hold', reason: 'Account security review' },
];

export function AdminControlPlaneView({ userToken, currentUser, demoMode = false, initialTab = 'dashboard' }: { userToken: string; currentUser: any; demoMode?: boolean; initialTab?: AdminControlPlaneTab }) {
  const [activeTab, setActiveTab] = useState<AdminControlPlaneTab>(initialTab);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userDetailData, setUserDetailData] = useState<any | null>(null);

  const [complianceCases, setComplianceCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [caseNotes, setCaseNotes] = useState<any[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [newCaseData, setNewCaseData] = useState({ subjectUserId: '', caseType: 'IDENTITY_REVIEW', priority: 'NORMAL', summary: '' });

  const [flaggedReviews, setFlaggedReviews] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [operationsQueue, setOperationsQueue] = useState<any[]>([]);
  const focusOperationsQueue = () => {
    setActiveTab('dashboard');
    window.setTimeout(() => document.getElementById('operations-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  };

  const fetchDashboard = async () => {
    if (demoMode) return;
    try {
      const res = await fetch('/api/admin/dashboard', { headers });
      const data = await res.json();
      if (data.metrics) setMetrics(data.metrics);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    if (demoMode) {
      setUsers(previewUsers);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}`, { headers });
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchComplianceCases = async () => {
    if (demoMode) return;
    try {
      const res = await fetch('/api/admin/compliance/cases', { headers });
      const data = await res.json();
      if (data.cases) setComplianceCases(data.cases);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchModerationReviews = async () => {
    if (demoMode) return;
    try {
      const res = await fetch('/api/admin/moderation/reviews', { headers });
      const data = await res.json();
      if (data.reviews) setFlaggedReviews(data.reviews);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    if (demoMode) return;
    try {
      const res = await fetch('/api/admin/audit-logs', { headers });
      const data = await res.json();
      if (data.auditLogs) setAuditLogs(data.auditLogs);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchOperationsQueue = async () => {
    if (demoMode) return;
    try {
      const res = await fetch('/api/admin/operations/queue', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Unable to load operations queue.');
      setOperationsQueue(data.items || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (demoMode) {
      setMetrics(previewMetrics);
      setUsers(previewUsers);
      setComplianceCases(previewComplianceCases);
      setFlaggedReviews(previewFlaggedReviews);
      setAuditLogs(previewAuditLogs);
      setOperationsQueue([
        { id: 'case_2048', type: 'COMPLIANCE_CASE', priority: 'HIGH', title: 'Payout review', summary: 'Coach payout held while identity review is completed.', targetId: 'usr_maya_chen' },
        { id: 'review_79', type: 'REVIEW_FLAG', priority: 'HIGH', title: 'Review requires moderation', summary: 'Participant report attached for review.', targetId: 'review_79' },
      ]);
      return;
    }
    fetchDashboard();
    fetchComplianceCases();
    fetchModerationReviews();
    fetchAuditLogs();
    fetchOperationsQueue();
  }, [demoMode]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, userSearch, demoMode]);

  const fetchUserDetail = async (id: string) => {
    if (demoMode) {
      const user = users.find((candidate) => candidate.id === id);
      if (user) {
        setSelectedUser(user);
        setUserDetailData({ user });
      }
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${id}`, { headers });
      const data = await res.json();
      setUserDetailData(data);
      setSelectedUser(data.user);
    } catch (err: any) {
      alert('Failed to load user detail: ' + err.message);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    if (currentUser?.role !== 'ADMIN') { alert('Only administrators can change user account status.'); return; }
    const reason = prompt('Enter suspension reason code (e.g. TERMS_VIOLATION):', 'TERMS_VIOLATION');
    if (!reason) return;
    const detail = prompt('Enter suspension details:', 'Policy violation');
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reasonCode: reason, reasonText: detail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to suspend user');
      alert('User suspended successfully.');
      fetchUsers();
      if (selectedUser) fetchUserDetail(selectedUser.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBanUser = async (userId: string) => {
    if (currentUser?.role !== 'ADMIN') { alert('Only administrators can change user account status.'); return; }
    const reason = prompt('Enter ban reason code (e.g. FRAUD):', 'FRAUD');
    if (!reason) return;
    const detail = prompt('Enter ban details:', 'Severe policy breach');
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reasonCode: reason, reasonText: detail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to ban user');
      alert('User banned successfully.');
      fetchUsers();
      if (selectedUser) fetchUserDetail(selectedUser.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestoreUser = async (userId: string) => {
    if (currentUser?.role !== 'ADMIN') { alert('Only administrators can change user account status.'); return; }
    const reasonText = prompt('Enter restoration reason:', 'Cleared compliance review');
    if (!reasonText) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/restore`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reasonText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore user');
      alert('User restored to active status.');
      fetchUsers();
      if (selectedUser) fetchUserDetail(selectedUser.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenComplianceCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/compliance/cases', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...newCaseData, reasonCode: newCaseData.caseType, reasonText: newCaseData.summary })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open case');
      alert('Compliance case opened successfully.');
      setShowNewCaseModal(false);
      fetchComplianceCases();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchCaseDetail = async (id: string) => {
    if (demoMode) {
      const selected = complianceCases.find((candidate) => candidate.id === id);
      if (selected) {
        setSelectedCase(selected);
        setCaseNotes([{
          id: `${id}_note`,
          noteText: 'Preview note: keep decisions evidence-based and independent from settlement outcomes.',
          createdAt: '2026-08-26T07:05:00.000Z',
        }]);
      }
      return;
    }
    try {
      const res = await fetch(`/api/admin/compliance/cases/${id}`, { headers });
      const data = await res.json();
      setSelectedCase(data.case);
      setCaseNotes(data.notes);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddCaseNote = async (caseId: string) => {
    if (!newNoteText.trim()) return;
    try {
      const res = await fetch(`/api/admin/compliance/cases/${caseId}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ noteText: newNoteText })
      });
      if (!res.ok) throw new Error('Failed to add note');
      setNewNoteText('');
      fetchCaseDetail(caseId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleModerateReview = async (reviewId: string, action: string) => {
    if (demoMode) return;
    const reasonText = prompt(`Reason for ${action.toLowerCase().replace('_', ' ')}:`, 'Moderator reviewed the reported content');
    if (!reasonText?.trim()) return;
    try {
      const res = await fetch(`/api/admin/moderation/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'POST',
        headers: { ...headers, 'Idempotency-Key': `review:${reviewId}:${action}:${reasonText.trim()}` },
        body: JSON.stringify({ action, reasonCode: `REVIEW_${action}`, reasonText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Moderation action failed.');
      await fetchModerationReviews();
      await fetchOperationsQueue();
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-indigo-600" />
            Operational Control Plane & Admin CRM
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Secure, audited operational management for Tradigo Platform ({currentUser?.role})
          </p>
            {demoMode && (
              <span className="mt-3 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Preview data · no production actions
              </span>
            )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchDashboard(); fetchComplianceCases(); fetchModerationReviews(); fetchAuditLogs(); fetchOperationsQueue(); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 space-x-8">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Dashboard & Queues
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          User CRM Directory
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'compliance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Compliance Cases ({complianceCases.length})
        </button>
        <button
          onClick={() => setActiveTab('moderation')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'moderation' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Review Moderation ({flaggedReviews.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'audit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Audit Trail
        </button>
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <button onClick={focusOperationsQueue} className="text-left bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300">
              <div className="text-sm font-medium text-gray-500">Open Compliance Cases</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{metrics?.openComplianceCasesCount ?? 0}</div>
            </button>
            <button onClick={focusOperationsQueue} className="text-left bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300">
              <div className="text-sm font-medium text-gray-500">Coach Applications</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{metrics?.pendingCoachApplicationsCount ?? 0}</div>
            </button>
            <button onClick={focusOperationsQueue} className="text-left bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300">
              <div className="text-sm font-medium text-gray-500">Flagged Reviews</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{metrics?.flaggedReviewsCount ?? 0}</div>
            </button>
            <button onClick={focusOperationsQueue} className="text-left bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300">
              <div className="text-sm font-medium text-gray-500">Suspended Users</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{metrics?.suspendedUsersCount ?? 0}</div>
            </button>
            <button onClick={focusOperationsQueue} className="text-left bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300">
              <div className="text-sm font-medium text-gray-500">Active Payout Holds</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{metrics?.activePayoutHoldsCount ?? 0}</div>
            </button>
          </div>

          <div id="operations-queue" className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Unified operations queue</h2>
                <p className="text-sm text-gray-500 mt-1">Disputes, conduct reports, review flags, settlement exceptions, applications, and compliance cases.</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{operationsQueue.length} open</span>
            </div>
            {operationsQueue.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">No operational items need attention.</p>
            ) : (
              <div className="space-y-3">
                {operationsQueue.slice(0, 12).map((item) => (
                  <button key={`${item.type}:${item.id}`} onClick={() => setActiveTab(item.type === 'REVIEW_FLAG' ? 'moderation' : 'compliance')} className="w-full rounded-lg border border-gray-200 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/30">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold tracking-wide text-indigo-700">{String(item.type).replaceAll('_', ' ')}</span>
                      <span className="text-xs font-semibold text-amber-700">{item.priority}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.summary || 'No additional context recorded.'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl">
            <h2 className="text-lg font-semibold text-indigo-900 mb-2">Operational Protocol & Governance</h2>
            <p className="text-sm text-indigo-700 leading-relaxed">
              All administrative and moderation actions executed in this control plane are fully authenticated, authorized, intent-specific, policy-validated, server-executed, and recorded in the immutable audit trail. Financial settlements remain independent of subjective review outcomes.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: USER CRM */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by display name, email, or user ID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{u.displayName || 'Unnamed'}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{u.role}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          u.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => fetchUserDetail(u.id)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Selected User Detail Inspector */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">User Inspector</h2>
              {selectedUser ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-gray-500 block">ID:</span>
                    <span className="font-mono text-xs text-gray-800">{selectedUser.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Display Name:</span>
                    <span className="font-medium text-gray-900">{selectedUser.displayName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Email:</span>
                    <span className="text-gray-900">{selectedUser.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Role & Status:</span>
                    <span className="font-medium text-gray-900">{selectedUser.role} / {selectedUser.status}</span>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <h3 className="font-semibold text-gray-900">Enforcement Actions</h3>
                    {selectedUser.status === 'ACTIVE' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSuspendUser(selectedUser.id)}
                          className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-amber-700"
                        >
                          Suspend
                        </button>
                        <button
                          onClick={() => handleBanUser(selectedUser.id)}
                          className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-red-700"
                        >
                          Ban
                        </button>
                      </div>
                    )}
                    {selectedUser.status !== 'ACTIVE' && (
                      <button
                        onClick={() => handleRestoreUser(selectedUser.id)}
                        className="w-full bg-green-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-green-700"
                      >
                        Restore Active Status
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Select a user from the directory to inspect profile and enforcement records.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMPLIANCE CASES */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Compliance & Trust Cases</h2>
            <button
              onClick={() => setShowNewCaseModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Open Compliance Case
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {complianceCases.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{c.caseType}</div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">{c.summary}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{c.priority}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">{c.status}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => fetchCaseDetail(c.id)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          View Case
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Case Detail & Notes */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Workspace</h2>
              {selectedCase ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-gray-500 block">Case ID:</span>
                    <span className="font-mono text-xs text-gray-800">{selectedCase.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Summary:</span>
                    <p className="text-gray-900 mt-1">{selectedCase.summary}</p>
                  </div>
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Confidential Case Notes</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                      {caseNotes.map((n) => (
                        <div key={n.id} className="bg-gray-50 p-2.5 rounded-lg text-xs">
                          <p className="text-gray-800">{n.noteText}</p>
                          <span className="text-gray-400 text-[10px] mt-1 block">{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add internal note..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleAddCaseNote(selectedCase.id)}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Select a compliance case to view details and add internal notes.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REVIEW MODERATION */}
      {activeTab === 'moderation' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Flagged & Moderated Reviews</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coach</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Review Text</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {flaggedReviews.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.coachName || 'Coach'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.overall_rating} ★</td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md truncate">{r.review_text || '(No text)'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{r.moderation_status}</span>
                      {!demoMode && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <button onClick={() => void handleModerateReview(r.id, 'HIDE')} className="rounded border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50">Hide</button>
                          <button onClick={() => void handleModerateReview(r.id, 'ESCALATE')} className="rounded border border-amber-200 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50">Escalate</button>
                          <button onClick={() => void handleModerateReview(r.id, 'RESTORE')} className="rounded border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">Restore</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Immutable Operational Audit Trail</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occurred At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{new Date(log.occurredAt).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600">{log.action}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700 font-mono">{log.targetType}: {log.targetId}</td>
                    <td className="px-6 py-4 text-xs text-gray-600">{log.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Compliance Case Modal */}
      {showNewCaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Open Compliance Case</h2>
            <form onSubmit={handleOpenComplianceCase} className="space-y-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Subject User ID (UUID)</label>
                <input
                  type="text"
                  required
                  value={newCaseData.subjectUserId}
                  onChange={(e) => setNewCaseData({ ...newCaseData, subjectUserId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Case Type</label>
                <select
                  value={newCaseData.caseType}
                  onChange={(e) => setNewCaseData({ ...newCaseData, caseType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="IDENTITY_REVIEW">IDENTITY_REVIEW</option>
                  <option value="COACH_CONDUCT">COACH_CONDUCT</option>
                  <option value="PAYMENT_REVIEW">PAYMENT_REVIEW</option>
                  <option value="PAYOUT_REVIEW">PAYOUT_REVIEW</option>
                  <option value="REVIEW_ABUSE">REVIEW_ABUSE</option>
                  <option value="SESSION_CONDUCT">SESSION_CONDUCT</option>
                  <option value="ACCOUNT_SECURITY">ACCOUNT_SECURITY</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Priority</label>
                <select
                  value={newCaseData.priority}
                  onChange={(e) => setNewCaseData({ ...newCaseData, priority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-1">Summary / Reason</label>
                <textarea
                  required
                  rows={3}
                  value={newCaseData.summary}
                  onChange={(e) => setNewCaseData({ ...newCaseData, summary: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                >
                  Create Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
