import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, auth } from '../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Note } from '../types';
import { StickyNote, Send, Sparkles, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { summarizeNotes } from '../lib/gemini';

interface ProjectNotesProps {
  projectId: string;
}

export default function ProjectNotes({ projectId }: ProjectNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'notes'), 
      where('projectId', '==', projectId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
      // Sort by date manually as firebase index might not be ready
      notesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setNotes(notesList);
    });
    return unsubscribe;
  }, [projectId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      await addDoc(collection(db, 'notes'), {
        projectId,
        content: newNote,
        date: new Date().toISOString(),
        ownerId: auth.currentUser?.uid
      });
      setNewNote('');
    } catch (error) {
      console.error("Error adding note:", error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteDoc(doc(db, 'notes', noteId));
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  const handleSummarize = async () => {
    if (notes.length === 0) return;
    setIsSummarizing(true);
    const result = await summarizeNotes(notes.map(n => n.content));
    setSummary(result);
    setIsSummarizing(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-bold text-slate-900 dark:text-white">Notas de Progreso ({notes.length})</h3>
        </div>
        <button 
          onClick={handleSummarize}
          disabled={isSummarizing || notes.length === 0}
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          Resumir con IA
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {summary && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Resumen IA de Progreso
            </h4>
            <div className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap leading-relaxed">
              {summary}
            </div>
            <button 
              onClick={() => setSummary(null)}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Cerrar resumen
            </button>
          </div>
        )}

        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 group relative">
              <p className="text-sm text-slate-800 dark:text-slate-200 mb-2 leading-relaxed">{note.content}</p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-500 font-medium">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(note.date).toLocaleString('es-CL')}
                </div>
                <button
                  type="button"
                  title="Eliminar nota"
                  onClick={() => handleDeleteNote(note.id!)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <div className="py-8 text-center text-slate-400 dark:text-slate-600 text-sm">
              No hay notas aún. Registra el progreso diario de la obra.
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
        <form onSubmit={handleAddNote} className="relative">
          <textarea 
            placeholder="Escribe un comentario sobre el progreso..."
            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white resize-none pr-12 min-h-[100px]"
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!newNote.trim()}
            className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
