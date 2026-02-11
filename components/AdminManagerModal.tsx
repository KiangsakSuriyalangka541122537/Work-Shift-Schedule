import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface AdminManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserData {
  id: number;
  username: string;
  name: string;
  created_at?: string;
}

export const AdminManagerModal: React.FC<AdminManagerModalProps> = ({ isOpen, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // State for user list
  const [userList, setUserList] = useState<UserData[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const fetchUsers = async () => {
    setLoadingList(true);
    try {
      // Changed table from 'users' to 'users-table-kik'
      const { data, error } = await supabase
        .from('users-table-kik')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      
      if (data) {
        setUserList(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      // Fallback: If no DB connection, we might show empty or handled externally
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!username || !password || !name) {
        throw new Error('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      }

      // Changed table from 'users' to 'users-table-kik'
      const { error } = await supabase
        .from('users-table-kik')
        .insert([{ username, password, name }]);

      if (error) {
        if (error.code === '23505') { // Unique violation
            throw new Error('ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว');
        }
        throw error;
      }

      setMessage({ type: 'success', text: 'เพิ่มผู้ดูแลเรียบร้อยแล้ว' });
      setUsername('');
      setPassword('');
      setName('');
      
      // Refresh list
      fetchUsers();

      // Clear success message after delay
      setTimeout(() => {
        setMessage(null);
      }, 3000);

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/20">
        
        {/* Header */}
        <div className="p-6 pb-0 relative shrink-0">
            <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full"
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>

            <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mb-3 text-indigo-600 ring-4 ring-indigo-50/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" x2="20" y1="8" y2="14"/><line x1="23" x2="17" y1="11" y2="11"/></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">จัดการผู้ดูแลระบบ</h2>
            <p className="text-sm text-slate-500">เพิ่มรายชื่อและตรวจสอบสิทธิ์การเข้าใช้งาน</p>
            </div>
        </div>

        <div className="overflow-y-auto px-6 pb-6 custom-scrollbar flex-1">
            {/* Add Form */}
            <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    เพิ่มผู้ใช้งานใหม่
                </h3>
                
                <div className="space-y-3">
                    <div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                            <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            placeholder="ชื่อเรียก (เช่น พี่ต่อ)"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                            <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            placeholder="Username"
                            />
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </div>
                            <input 
                            type="text" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            placeholder="Password"
                            />
                        </div>
                    </div>
                </div>

                {message && (
                    <div className={`mt-3 text-xs p-2 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {message.type === 'success' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                        )}
                        {message.text}
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full mt-3 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 text-sm flex justify-center items-center"
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            กำลังบันทึก...
                        </span>
                    ) : 'บันทึกรายชื่อ'}
                </button>
            </div>
            </form>

            {/* User List */}
            <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                         รายชื่อผู้ใช้งานปัจจุบัน
                    </div>
                    <span className="text-xs font-normal text-slate-400">ทั้งหมด {userList.length} คน</span>
                </h3>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {loadingList ? (
                        <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : userList.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm bg-slate-50/50">
                            ยังไม่มีข้อมูลผู้ใช้งาน
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                            {userList.map((user) => (
                                <div key={user.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs ring-2 ring-white shadow-sm">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-700">{user.name}</div>
                                            <div className="text-xs text-slate-400">User: {user.username}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">
                                        •••••
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};