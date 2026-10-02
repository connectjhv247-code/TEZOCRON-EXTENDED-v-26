import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface UserRequestItem {
  id: string;
  userName?: string;
  userEmail?: string;
  requestMessage?: string;
  wordCount?: number;
  timestamp?: { seconds?: number; nanoseconds?: number } | any;
  createdAt?: string;
}

interface AdminRequestsPageProps {
  onBack?: () => void;
}

export default function AdminRequestsPage({ onBack }: AdminRequestsPageProps = {}) {
  const [requests, setRequests] = useState<UserRequestItem[]>([]);

  useEffect(() => {
    const q = query(collection(db, "requests"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRequestItem)));
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Inbox - User Requests ({requests.length})</h1>
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
            else if (window.history.length > 1) window.history.back();
            else window.location.href = '/';
          }}
          className="rounded-xl border border-white/10 bg-white/10 hover:bg-white/20 px-3.5 py-1.5 text-xs font-semibold text-white transition-all cursor-pointer"
        >
          &larr; Back
        </button>
      </div>

      {requests.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-400">
          No user requests in the inbox yet.
        </div>
      )}

      {requests.map(r => (
        <div key={r.id} className="bg-white/10 backdrop-blur p-4 rounded-xl mb-3 border border-white/10">
          <div className="flex justify-between items-start">
            <p className="font-bold text-white">{r.userName || 'TEZOCRON Member'}</p>
            <p className="text-xs text-gray-400">
              {r.timestamp?.seconds
                ? new Date(r.timestamp.seconds * 1000).toLocaleString()
                : (r.createdAt ? new Date(r.createdAt).toLocaleString() : 'Just now')}
            </p>
          </div>
          <p className="text-sm text-gray-400">{r.userEmail || 'Authorized Account'}</p>
          <p className="mt-2 text-lg text-slate-100">"{r.requestMessage}"</p>
          <button
            type="button"
            onClick={async () => await deleteDoc(doc(db, "requests", r.id))}
            className="mt-3 bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm font-semibold transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
