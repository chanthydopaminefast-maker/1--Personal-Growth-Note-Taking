import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, deleteDoc, getDocFromServer, collection, writeBatch } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'; 
import { AppData, BackupEntry, Student } from '../types';
import firebaseConfig from '../firebase-applet-config.json';
import { storage } from './storage';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); // CRITICAL: Database ID
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Auth Helpers
export { signInWithEmailAndPassword, createUserWithEmailAndPassword };

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error (Soft Logged for Vercel/Offline Resilience): ', JSON.stringify(errInfo));
  isOffline = true;
  // Graceful no-crash fallback for unauthorized error or offline behavior
}

const DOC_PATH = 'portal/data';

let isOffline = false;

// Authenticate via Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-in Error:", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Sign-out Error:", error);
  }
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
      isOffline = true;
    }
  }
}
testConnection();

// Global cache to prevent race conditions between local writes and remote snapshots
const activeSubscriptions = new Map<string, {
  currentData: AppData;
  onData: (data: AppData) => void;
  pendingUpdates: Set<string>; // Track paths currently being written
}>();

const updateLocalCache = (userId: string, updates: Partial<AppData>) => {
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    // Merge updates deeply for top-level objects to prevent partial data loss
    const newData = { ...sub.currentData };
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        (newData as any)[key] = { ...((newData as any)[key] || {}), ...value };
      } else {
        (newData as any)[key] = value;
      }
    });

    sub.currentData = newData;
    sub.onData({ ...sub.currentData });
  }
};

// 4. Real-time Subscription logic needed by App.tsx
// Aggregates data from subcollections to keep AppData interface compatible
export const subscribeToData = (
  userId: string,
  onData: (data: AppData) => void,
  onError: (error: any) => void
) => {
  if (!userId) {
    onError(new Error("User not authenticated"));
    return () => {};
  }
  
  const docRef = doc(db, 'users', userId, 'appData', 'data');
  const unsubscribes: (() => void)[] = [];
  
  // Initialize from localStorage first to prevent partial state wipes on initial load
  let initialData: AppData = { 
    students: [], 
    attendance: {}, 
    systemLocked: false,
    expenses: [],
    journalEntries: {},
    dpssTopics: [],
    habitCompletions: {},
    dailyNotes: {},
    habits: []
  };

  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('dps_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        initialData = { ...initialData, ...parsed };
      }
    } catch (e) {
      console.warn("Failed to parse local data for initial subscription baseline", e);
    }
  }

  let currentData: AppData = initialData;
  activeSubscriptions.set(userId, { 
    currentData, 
    onData: (data) => {
      // Direct call to onData to update the frontend
      onData(data);
    },
    pendingUpdates: new Set()
  });

  const notifyChange = () => {
    const sub = activeSubscriptions.get(userId);
    if (sub) {
      onData({ ...sub.currentData });
    }
  };

  // 1. Subscribe to main settings document
  const unsubMain = onSnapshot(docRef, (docSnap) => {
    const sub = activeSubscriptions.get(userId);
    if (!sub) return;

    if (docSnap.exists()) {
      const mainData = docSnap.data() as any;
      
      // Specifically avoid clobbering fields that are handled by subcollection subscriptions
      const { 
        students, 
        habits, 
        expenses, 
        journalEntries, 
        attendance, 
        dpssTopics, 
        habitCompletions, 
        dailyNotes,
        selfLearningTopics,
        ...filteredMainData 
      } = mainData;

      // Check for pending updates to main settings document
      if (!sub.pendingUpdates.has('mainData')) {
        sub.currentData = { ...sub.currentData, ...filteredMainData };
        notifyChange();
      }
      
      // Backward compatibility Migration: if habits exist in main doc, move them to subcollection
      if (mainData.habits && Array.isArray(mainData.habits) && mainData.habits.length > 0) {
        const batch = writeBatch(db);
        mainData.habits.forEach((h: any) => {
          const hRef = doc(db, 'users', userId, 'habits', h.id);
          batch.set(hRef, h, { merge: true });
        });
        // Remove habits from main doc to prevent duplicates/loops
        batch.update(docRef, { habits: [] });
        batch.commit().catch(e => console.warn("Migration commit failed", e));
      }
    } else {
      const initialDoc: AppData = { students: [], attendance: {}, systemLocked: false, habits: [] };
      setDoc(docRef, initialDoc).catch((err) => handleFirestoreError(err, OperationType.WRITE, docRef.path));
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, docRef.path));
  unsubscribes.push(unsubMain);

  // 1.1 Subscribe to Habits collection
  const habitsRef = collection(db, 'users', userId, 'habits');
  const unsubHabits = onSnapshot(habitsRef, (querySnap) => {
    const sub = activeSubscriptions.get(userId);
    if (sub && !sub.pendingUpdates.has('habits')) {
      sub.currentData.habits = querySnap.docs.map(d => d.data() as any).sort((a, b) => (a.order || 0) - (b.order || 0));
      notifyChange();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, habitsRef.path));
  unsubscribes.push(unsubHabits);

  // 2. Subscribe to Students collection
  const studentsRef = collection(db, 'users', userId, 'students');
  const unsubStudents = onSnapshot(studentsRef, (querySnap) => {
    const sub = activeSubscriptions.get(userId);
    if (sub) {
      sub.currentData.students = querySnap.docs.map(d => d.data() as Student).sort((a, b) => (a.order || 0) - (b.order || 0));
      notifyChange();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, studentsRef.path));
  unsubscribes.push(unsubStudents);

  // 3. Subscribe to Expenses collection
  const expensesRef = collection(db, 'users', userId, 'expenses');
  const unsubExpenses = onSnapshot(expensesRef, (querySnap) => {
    const sub = activeSubscriptions.get(userId);
    if (sub) {
      sub.currentData.expenses = querySnap.docs.map(d => d.data() as any);
      notifyChange();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, expensesRef.path));
  unsubscribes.push(unsubExpenses);

  // 4. Subscribe to Journal collection
  const journalRef = collection(db, 'users', userId, 'journal');
  const unsubJournal = onSnapshot(journalRef, (querySnap) => {
    const entries: any = {};
    querySnap.docs.forEach(d => { entries[d.id] = d.data(); });
    const sub = activeSubscriptions.get(userId);
    if (sub) {
      sub.currentData.journalEntries = entries;
      notifyChange();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, journalRef.path));
  unsubscribes.push(unsubJournal);

  // 5. Subscribe to Attendance collection
  const attendanceRef = collection(db, 'users', userId, 'attendance');
  const unsubAttendance = onSnapshot(attendanceRef, (querySnap) => {
    const attendance: any = {};
    querySnap.docs.forEach(d => { attendance[d.id] = d.data(); });
    const sub = activeSubscriptions.get(userId);
    if (sub) {
      sub.currentData.attendance = attendance;
      notifyChange();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, attendanceRef.path));
  unsubscribes.push(unsubAttendance);

  // 7. Subscribe to DPSS Topics collection
  const topicsRef = collection(db, 'users', userId, 'dpssTopics');
  const unsubTopics = onSnapshot(topicsRef, (querySnap) => {
    const sub = activeSubscriptions.get(userId);
    if (sub) {
      sub.currentData.dpssTopics = querySnap.docs.map(d => d.data() as any);
      notifyChange();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, topicsRef.path));
  unsubscribes.push(unsubTopics);

  // 8. Subscribe to Habit Completions collection
  const habitCompRef = collection(db, 'users', userId, 'habitCompletions');
  const unsubHabitComp = onSnapshot(habitCompRef, (querySnap) => {
    const sub = activeSubscriptions.get(userId);
    if (sub) {
      const completions: any = { ...sub.currentData.habitCompletions };
      querySnap.docs.forEach(d => { 
        if (!sub.pendingUpdates.has(`habitCompletions/${d.id}`)) {
          completions[d.id] = d.data(); 
        }
      });
      sub.currentData.habitCompletions = completions;
      notifyChange();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, habitCompRef.path));
  unsubscribes.push(unsubHabitComp);

  // 9. Subscribe to Daily Notes collection
  const notesRef = collection(db, 'users', userId, 'dailyNotes');
  const unsubNotes = onSnapshot(notesRef, (querySnap) => {
    const notes: any = {};
    querySnap.docs.forEach(d => { notes[d.id] = (d.data() as any).content || d.data(); });
    const sub = activeSubscriptions.get(userId);
    if (sub) {
      sub.currentData.dailyNotes = notes;
      notifyChange();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, notesRef.path));
  unsubscribes.push(unsubNotes);

  // 10. Subscribe to Self Learning Topics collection
  const slRef = collection(db, 'users', userId, 'selfLearningTopics');
  const unsubSl = onSnapshot(slRef, (querySnap) => {
    const sub = activeSubscriptions.get(userId);
    if (sub) {
      sub.currentData.selfLearningTopics = querySnap.docs.map(d => d.data() as any);
      notifyChange();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, slRef.path));
  unsubscribes.push(unsubSl);

  return () => {
    unsubscribes.forEach(u => u());
    activeSubscriptions.delete(userId);
  };
};

export const saveData = async (userId: string, data: AppData) => {
  if (!userId) return;
  
  // Prioritize local update to cache
  updateLocalCache(userId, data);

  const sub = activeSubscriptions.get(userId);
  if (sub) sub.pendingUpdates.add('mainData');

  const { 
    students, 
    expenses, 
    journalEntries, 
    dpssTopics, 
    attendance,
    habitCompletions, 
    dailyNotes,
    selfLearningTopics,
    habits,
    ...mainSettings 
  } = data;

  const docRef = doc(db, 'users', userId, 'appData', 'data');
  
  try {
    await setDoc(docRef, mainSettings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docRef.path);
  } finally {
    if (sub) {
      // Clear pending status after a delay to ensure snapshot with new data is likely processed
      setTimeout(() => sub.pendingUpdates.delete('mainData'), 3000);
    }
  }
};

export const saveHabitCompletion = async (userId: string, date: string, habitId: string, completed: boolean | number) => {
  if (!userId || !date || !habitId) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const completions = { ...(sub.currentData.habitCompletions || {}) };
    const day = { ...(completions[date] || {}), [habitId]: completed };
    completions[date] = day;
    updateLocalCache(userId, { habitCompletions: completions });
    sub.pendingUpdates.add(`habitCompletions/${date}`);
  }

  try {
    const docRef = doc(db, 'users', userId, 'habitCompletions', date);
    await setDoc(docRef, { [habitId]: completed }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/habitCompletions/${date}`);
  } finally {
    if (sub) {
      setTimeout(() => sub.pendingUpdates.delete(`habitCompletions/${date}`), 3000);
    }
  }
};

// Specialized save functions to avoid rewriting everything and improve performance
export const saveStudent = async (userId: string, student: Student) => {
  if (!userId || !student || !student.id) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const students = sub.currentData.students || [];
    const idx = students.findIndex(s => s.id === student.id);
    if (idx !== -1) students[idx] = student;
    else students.push(student);
    updateLocalCache(userId, { students });
  }

  try {
    const docRef = doc(db, 'users', userId, 'students', student.id);
    await setDoc(docRef, student, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/students/${student.id}`);
  }
};

export const deleteStudent = async (userId: string, studentId: string) => {
  if (!userId || !studentId) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    updateLocalCache(userId, { students: (sub.currentData.students || []).filter(s => s.id !== studentId) });
  }

  try {
    const docRef = doc(db, 'users', userId, 'students', studentId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/students/${studentId}`);
  }
};

export const saveAttendance = async (userId: string, date: string, data: Record<string, number>) => {
  if (!userId || !date) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const attendance = { ...(sub.currentData.attendance || {}), [date]: data };
    updateLocalCache(userId, { attendance });
  }

  try {
    const docRef = doc(db, 'users', userId, 'attendance', date);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/attendance/${date}`);
  }
};

export const saveExpense = async (userId: string, expense: any, isDelete: boolean = false) => {
  if (!userId || !expense || !expense.id) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const expenses = (sub.currentData.expenses || []).filter(e => e.id !== expense.id);
    if (!isDelete) expenses.push(expense);
    updateLocalCache(userId, { expenses });
  }

  try {
    const docRef = doc(db, 'users', userId, 'expenses', expense.id);
    if (isDelete) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, expense, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, isDelete ? OperationType.DELETE : OperationType.WRITE, `users/${userId}/expenses/${expense.id}`);
  }
};

export const saveJournalEntry = async (userId: string, date: string, entry: any) => {
  if (!userId || !date) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const journalEntries = { ...(sub.currentData.journalEntries || {}), [date]: entry };
    updateLocalCache(userId, { journalEntries });
  }

  try {
    const docRef = doc(db, 'users', userId, 'journal', date);
    await setDoc(docRef, entry, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/journal/${date}`);
  }
};

export const saveTopic = async (userId: string, topic: any, category: 'dpss' | 'selfLearning' = 'dpss') => {
  if (!userId || !topic || !topic.id) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const field = category === 'dpss' ? 'dpssTopics' : 'selfLearningTopics';
    const topics = [...(sub.currentData[field] || [])];
    const idx = topics.findIndex(t => t.id === topic.id);
    if (idx !== -1) topics[idx] = topic; else topics.push(topic);
    updateLocalCache(userId, { [field]: topics });
  }

  try {
    const coll = category === 'dpss' ? 'dpssTopics' : 'selfLearningTopics';
    const docRef = doc(db, 'users', userId, coll, topic.id);
    await setDoc(docRef, topic, { merge: true });
  } catch (error) {
    const coll = category === 'dpss' ? 'dpssTopics' : 'selfLearningTopics';
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/${coll}/${topic.id}`);
  }
};

export const deleteTopic = async (userId: string, topicId: string, category: 'dpss' | 'selfLearning' = 'dpss') => {
  if (!userId || !topicId) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const field = category === 'dpss' ? 'dpssTopics' : 'selfLearningTopics';
    updateLocalCache(userId, { [field]: (sub.currentData[field] || []).filter((t: any) => t.id !== topicId) });
  }

  try {
    const coll = category === 'dpss' ? 'dpssTopics' : 'selfLearningTopics';
    const docRef = doc(db, 'users', userId, coll, topicId);
    await deleteDoc(docRef);
  } catch (error) {
    const coll = category === 'dpss' ? 'dpssTopics' : 'selfLearningTopics';
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/${coll}/${topicId}`);
  }
};

export const saveDailyNote = async (userId: string, date: string, content: string) => {
  if (!userId || !date) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const dailyNotes = { ...(sub.currentData.dailyNotes || {}), [date]: content };
    updateLocalCache(userId, { dailyNotes });
  }

  try {
    const docRef = doc(db, 'users', userId, 'dailyNotes', date);
    await setDoc(docRef, { content, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/dailyNotes/${date}`);
  }
};

export const saveHabitList = async (userId: string, habits: any[]) => {
  if (!userId) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const currentHabits = [...(sub.currentData.habits || [])];
    habits.forEach(newH => {
      const idx = currentHabits.findIndex(h => h.id === newH.id);
      if (idx !== -1) currentHabits[idx] = newH; else currentHabits.push(newH);
    });
    updateLocalCache(userId, { habits: currentHabits });
    sub.pendingUpdates.add('habits');
  }

  const batch = writeBatch(db);
  try {
    habits.forEach(h => {
      const hRef = doc(db, 'users', userId, 'habits', h.id);
      batch.set(hRef, h, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/habits/batch`);
  } finally {
    if (sub) {
      setTimeout(() => sub.pendingUpdates.delete('habits'), 3000);
    }
  }
};

export const deleteHabit = async (userId: string, habitId: string) => {
  if (!userId || !habitId) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    updateLocalCache(userId, { habits: (sub.currentData.habits || []).filter(h => h.id !== habitId) });
    sub.pendingUpdates.add('habits');
  }

  try {
    const docRef = doc(db, 'users', userId, 'habits', habitId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/habits/${habitId}`);
  } finally {
    if (sub) {
      setTimeout(() => sub.pendingUpdates.delete('habits'), 3000);
    }
  }
};

export const saveHabitCompletionBulk = async (userId: string, date: string, completions: Record<string, boolean | number>) => {
  if (!userId || !date) return;
  
  // Update local cache
  const sub = activeSubscriptions.get(userId);
  if (sub) {
    const habitCompletions = { ...(sub.currentData.habitCompletions || {}), [date]: completions };
    updateLocalCache(userId, { habitCompletions });
  }

  try {
    const docRef = doc(db, 'users', userId, 'habitCompletions', date);
    await setDoc(docRef, completions, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/habitCompletions/${date}`);
  }
};

export const createCloudBackup = async (data: AppData, type: 'Auto' | 'Manual' = 'Manual') => {
  console.log(`Local backup created (${type})`);
  const historyKey = 'dps_backups_local';
  const stored = await storage.getItem(historyKey);
  const history = JSON.parse(stored || '[]');
  history.unshift({
    timestamp: new Date().toISOString(),
    data: data,
    type: type,
    id: Math.random().toString(36).substr(2, 9)
  });
  await storage.setItem(historyKey, JSON.stringify(history.slice(0, 10)));
};

export const getCloudBackups = async (): Promise<Partial<BackupEntry>[]> => {
  const historyKey = 'dps_backups_local';
  const stored = await storage.getItem(historyKey);
  return JSON.parse(stored || '[]');
};

export const getSyncStatus = () => !isOffline;
