import { Bell, Clock, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';

function AutoLogoutTimer() {
  const [timeoutMins, setTimeoutMins] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  useEffect(() => {
    let lastActivity = Date.now();
    let timeoutThreshold = timeoutMins * 60 * 1000;
    
    // Reset timer immediately when changing the dropdown
    setTimeLeft(timeoutMins * 60);

    const updateActivity = () => {
      lastActivity = Date.now();
    };

    // Removed mousemove and scroll to prevent the timer from "freezing" when user just moves mouse
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, timeoutThreshold - (now - lastActivity));
      setTimeLeft(Math.floor(remaining / 1000));

      if (remaining <= 0) {
        signOut(auth);
      }
    }, 1000);

    return () => {
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      clearInterval(interval);
    }
  }, [timeoutMins]);

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400" title="Tempo até o logout automático por inatividade">
      <Clock className="w-3.5 h-3.5" />
      <span className="text-xs font-semibold font-mono">{mins}:{secs}</span>
      <select 
        className="ml-1 bg-transparent text-xs text-red-400 font-semibold focus:outline-none cursor-pointer appearance-none border-l border-red-500/30 pl-2" 
        value={timeoutMins} 
        onChange={(e) => setTimeoutMins(Number(e.target.value))}
      >
        <option value={15} className="bg-[#111]">15m</option>
        <option value={30} className="bg-[#111]">30m</option>
        <option value={60} className="bg-[#111]">60m</option>
      </select>
    </div>
  );
}

export function Header({ title, userName }) {
  return (
    <header className="w-full px-6 py-4 flex items-center justify-between sticky top-0 z-40 bg-brand-black/80 backdrop-blur-xl border-b border-white/5">
      <div className="md:hidden flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#111] to-[#222] border border-white/10 flex items-center justify-center text-sm font-brand font-bold glow-blue">S</div>
        <h1 className="font-brand text-lg font-semibold tracking-tight">SlimCare <span className="text-gradient-gold font-bold">Ultra</span></h1>
      </div>
      
      <div className="hidden md:flex flex-col">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-brand-gray">Hoje, 24 de Maio</p>
      </div>

      <div className="flex items-center gap-4">
        {userName && (
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-xs text-brand-gray uppercase tracking-wider font-semibold">Conectado como</span>
            <span className="text-sm font-bold text-white">{userName}</span>
          </div>
        )}

        <AutoLogoutTimer />

        <button className="p-2 rounded-full hover:bg-white/10 transition relative">
          <Bell className="w-5 h-5 text-brand-gray" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-brand-blue rounded-full border-2 border-brand-black"></span>
        </button>
      </div>
    </header>
  );
}
