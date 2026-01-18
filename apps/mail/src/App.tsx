// Main App component - Email Triage Interface
// Refactored from demo-triage-inbox.html into proper React components

import { useState, useMemo, useEffect } from 'react';
import type { ProcessedEmail, TriageBucket } from './lib';
import { filterEmails } from './lib';
import { loadSampleEmails } from './lib/sampleData';
import { Sidebar, type ViewMode, type RequestTab } from './components/Sidebar';
import { EmailList } from './components/EmailList';
import { DetailView } from './components/DetailView';
import './index.css';

const CURRENT_USER_EMAIL = 'neal@ballardfineart.com';

function App() {
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // View state
  const [activeView, setActiveView] = useState<ViewMode>('triage');
  const [activeBucket, setActiveBucket] = useState<TriageBucket | 'ALL'>('ALL');
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [requestTab, setRequestTab] = useState<RequestTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Load emails on mount
  useEffect(() => {
    const loaded = loadSampleEmails();
    setEmails(loaded);
    if (loaded.length > 0) {
      setSelectedId(loaded[0].id);
    }
    setLoading(false);
  }, []);

  // Filter and sort emails based on view and filters
  const filteredEmails = useMemo(() => {
    let filtered = emails;

    // Apply view-level filters
    if (activeView === 'requests') {
      if (requestTab === 'received') {
        filtered = filtered.filter(e => e.from !== CURRENT_USER_EMAIL);
      } else if (requestTab === 'sent') {
        filtered = filtered.filter(e => e.from === CURRENT_USER_EMAIL);
      } else if (requestTab === 'pending') {
        // Pending: Incoming emails that need action/approval
        filtered = filtered.filter(e =>
          e.from !== CURRENT_USER_EMAIL &&
          (e.triage?.bucket === 'ACTION_REQUIRED' || e.triage?.bucket === 'APPROVAL_NEEDED')
        );
      }
    } else {
      // Triage view: filter out sent items
      filtered = filtered.filter(e => e.from !== CURRENT_USER_EMAIL);

      if (activeBucket !== 'ALL') {
        filtered = filterEmails(filtered, { bucket: activeBucket });
      }

      // Filter by project
      if (activeProject) {
        filtered = filtered.filter(e => e.projectName === activeProject);
      }
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.subject.toLowerCase().includes(query) ||
        e.fromName.toLowerCase().includes(query) ||
        e.projectName.toLowerCase().includes(query)
      );
    }

    // Sort: by date for Requests, by priority for Triage
    return filtered.sort((a, b) => {
      if (activeView === 'requests') {
        return new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime();
      }
      return b.priority - a.priority;
    });
  }, [emails, activeView, activeBucket, activeProject, requestTab, searchQuery]);

  const selectedEmail = useMemo(
    () => emails.find(e => e.id === selectedId) || null,
    [emails, selectedId]
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading emails...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        activeBucket={activeBucket}
        onBucketChange={setActiveBucket}
        activeProject={activeProject}
        onProjectChange={setActiveProject}
        requestTab={requestTab}
        onRequestTabChange={setRequestTab}
        emails={emails}
        currentUserEmail={CURRENT_USER_EMAIL}
      />

      <EmailList
        emails={filteredEmails}
        selectedId={selectedId}
        onSelectEmail={(email) => setSelectedId(email.id)}
        activeView={activeView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <DetailView email={selectedEmail} />
    </div>
  );
}

export default App;
