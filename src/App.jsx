import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { Treatment } from './pages/Treatment';
import { Health } from './pages/Health';
import { Journey } from './pages/Journey';
import { Premium } from './pages/Premium';
import { Landing } from './pages/Landing';
import { AdminDashboard } from './pages/AdminDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { ProfileSettings } from './pages/ProfileSettings';
import { Sparkles } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'paciente', 'medico', 'admin'
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.status === 'pending' || userData.status === 'rejected') {
              // Landing.jsx will show the message. We just clear state.
              await signOut(auth);
              setIsLoggedIn(false);
              setUserRole(null);
              setCurrentUser(null);
            } else {
              setUserRole(userData.role);
              setCurrentUser({ uid: user.uid, ...userData });
              setIsLoggedIn(true);
            }
          } else {
            setIsLoggedIn(false);
            setUserRole(null);
            setCurrentUser(null);
          }
        } else {
          setIsLoggedIn(false);
          setUserRole(null);
          setCurrentUser(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        setIsLoggedIn(false);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (role) => {
    // Legacy mockup handler if needed, but now Firebase handles it.
  };

  const handleLogout = async () => {
    await signOut(auth);
    setActiveTab('dashboard');
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-brand-black text-white">
        <Sparkles className="w-10 h-10 animate-pulse text-brand-blue" />
      </div>
    );
  }

  const renderContent = () => {
    if (activeTab === 'profile') return <ProfileSettings currentUser={currentUser} userRole={userRole} />;
    
    if (userRole === 'admin') return <AdminDashboard />;
    if (userRole === 'medico') return <DoctorDashboard currentUser={currentUser} />;

    // Navigation for Patients
    switch (activeTab) {
      case 'dashboard': return <Dashboard currentUser={currentUser} />;
      case 'treatment': return <Treatment currentUser={currentUser} />;
      case 'health': return <Health currentUser={currentUser} />;
      case 'calendar': return <Journey currentUser={currentUser} />;
      case 'ultra': return <Premium currentUser={currentUser} />;
      default: return <Dashboard currentUser={currentUser} />;
    }
  };

  const getHeaderTitle = () => {
    if (activeTab === 'profile') return 'Meu Perfil';
    if (userRole === 'admin') return 'Painel Administrativo';
    if (userRole === 'medico') return 'Portal do Médico';

    const titles = {
      'dashboard': 'Visão Geral',
      'treatment': 'Acompanhamento Farmacológico',
      'health': 'Inteligência Metabólica',
      'calendar': 'Jornada Clínica',
      'ultra': 'Acesso Premium'
    };
    return titles[activeTab] || 'Visão Geral';
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-brand-black">
      {!isLoggedIn ? (
        <Landing onLogin={handleLogin} />
      ) : (
        <>
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} onLogout={handleLogout} />
          
          <main className="flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden relative">
          <Header 
            title={getHeaderTitle()}
            userName={currentUser?.name || currentUser?.nome}
          />
          <div className="p-6 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
              {renderContent()}
            </div>

            {/* Floating AI Assistant Button */}
            <button className="fixed bottom-20 md:bottom-10 right-6 w-14 h-14 rounded-full bg-gradient-to-tr from-brand-blue to-indigo-500 shadow-xl glow-blue flex items-center justify-center hover:scale-110 transition-all z-50 group">
              <Sparkles className="w-6 h-6 text-white group-hover:animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
            </button>
          </main>
        </>
      )}
    </div>
  );
}

export default App;
