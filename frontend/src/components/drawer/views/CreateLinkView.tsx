import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useCreateLink, useLinkTypes, useSearch } from '../../../api/hooks';
import { useDebounce } from '../../../hooks/useDebounce';

interface CreateLinkViewProps {
  sourceRecordId: string;
}

export function CreateLinkView({ sourceRecordId }: CreateLinkViewProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [linkType, setLinkType] = useState('related_to');
  
  const { closeDrawer } = useUIStore();
  const createLink = useCreateLink();
  const { data: linkTypes } = useLinkTypes();
  const { data: searchResults, isLoading: isSearching } = useSearch(debouncedQuery, undefined, !!debouncedQuery && debouncedQuery.length > 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId) return;

    try {
      await createLink.mutateAsync({
        sourceRecordId,
        targetRecordId: selectedTargetId,
        linkType,
        metadata: {} // Default empty metadata
      });
      closeDrawer();
    } catch (err) {
      console.error('Failed to create link:', err);
    }
  };

  const records = searchResults?.filter(r => r.type === 'record' && r.id !== sourceRecordId) || [];

  return (
    <div className="max-w-xl mx-auto flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-800">Create Record Link</h3>
        <p className="text-sm text-slate-600">
          Search for a target record and select a relationship type.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col min-h-0">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Link Type
          </label>
          <select
             value={linkType}
             onChange={(e) => setLinkType(e.target.value)}
             className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
             {linkTypes?.map(t => <option key={t} value={t}>{t}</option>) || <option value="related_to">related_to</option>}
          </select>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Target Record
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a record..."
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            autoFocus
          />
          
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md bg-slate-50 p-1 custom-scroll">
             {isSearching ? (
                 <div className="p-4 text-center text-slate-400 text-sm">Searching...</div>
             ) : records.length === 0 ? (
                 <div className="p-4 text-center text-slate-400 text-sm">
                    {query.length < 2 ? 'Type at least 2 characters to search' : 'No records found'}
                 </div>
             ) : (
                 <div className="space-y-1">
                    {records.map(record => (
                        <div 
                           key={record.id}
                           onClick={() => setSelectedTargetId(record.id)}
                           className={`p-2 rounded cursor-pointer transition-colors flex items-center gap-2 ${
                               selectedTargetId === record.id 
                               ? 'bg-blue-100 border border-blue-300 text-blue-900' 
                               : 'bg-white border border-slate-200 hover:border-blue-300'
                           }`}
                        >
                            <Link2 size={14} className={selectedTargetId === record.id ? 'text-blue-500' : 'text-slate-400'} />
                            <div>
                                <div className="text-sm font-medium">{record.name}</div>
                                {record.definitionName && (
                                    <div className="text-xs text-slate-400">{record.definitionName}</div>
                                )}
                            </div>
                        </div>
                    ))}
                 </div>
             )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={closeDrawer}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedTargetId || createLink.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createLink.isPending ? 'Linking...' : 'Create Link'}
          </button>
        </div>
      </form>
    </div>
  );
}