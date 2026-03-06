import { useState } from 'react';
import { getUsers } from '../services/api';

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');

  const handleLogin = async (username: string, password: string) => {
    try {
      const users = await getUsers();
      const user = users.find((u: any) => u.username === username && u.password === password);
      
      if (user) {
        setIsLoggedIn(true);
        setCurrentUser(user.name);
        setCurrentUsername(user.username);
        return true;
      } else {
        alert('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      return false;
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser('');
    setCurrentUsername('');
  };

  return {
    isLoggedIn,
    currentUser,
    currentUsername,
    handleLogin,
    handleLogout
  };
};
