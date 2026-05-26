import { LayoutDashboard, Syringe, Activity, CalendarHeart, Sparkles, LogOut, UserCog } from 'lucide-react';
import clsx from 'clsx';

export function Sidebar({ activeTab, setActiveTab, userRole, onLogout }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'treatment', label: 'Tratamento', icon: Syringe },
    { id: 'health', label: 'Metabólico', icon: Activity },
    { id: 'calendar', label: 'Jornada', icon: CalendarHeart },
  ];

  return (
    <nav className="glass border-t md:border-t-0 md:border-r border-white/10 w-full md:w-24 lg:w-64 fixed bottom-0 md:relative md:h-screen z-50 flex md:flex-col justify-between px-4 py-3 md:py-8 transition-all">
      {/* Branding */}
      <div className="hidden md:flex flex-col items-center lg:items-start lg:px-4 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#111] to-[#222] border border-white/10 shadow-lg flex items-center justify-center text-xl font-brand font-bold glow-blue mb-4">
          S
        </div>
        <h1 className="font-brand text-xl font-semibold hidden lg:block tracking-tight">SlimCare <span className="text-gradient-gold font-bold">Ultra</span></h1>
        <p className="text-[10px] uppercase tracking-[0.2em] text-brand-gray hidden lg:block mt-1">Inteligência Clínica</p>
      </div>

      {/* Navigation Links */}
      <div className="flex md:flex-col w-full justify-around md:justify-start gap-1 md:gap-4 lg:px-2 flex-1">
        {userRole === 'paciente' && navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                "flex flex-col lg:flex-row items-center lg:justify-start gap-1 lg:gap-3 p-2 lg:px-4 lg:py-3 rounded-xl hover:bg-white/5 w-full transition-all group",
                isActive ? "text-white" : "text-brand-gray"
              )}
            >
              <Icon className={clsx(
                "w-6 h-6 lg:w-5 lg:h-5 transition-all group-hover:scale-110",
                isActive && "text-brand-blue drop-shadow-[0_0_8px_rgba(50,173,230,0.5)]"
              )} />
              <span className="text-[10px] lg:text-sm font-medium">{item.label}</span>
            </button>
          );
        })}

        {userRole !== 'paciente' && (
          <button
            onClick={() => setActiveTab('dashboard')}
            className={clsx(
              "flex flex-col lg:flex-row items-center lg:justify-start gap-1 lg:gap-3 p-2 lg:px-4 lg:py-3 rounded-xl hover:bg-white/5 w-full transition-all group",
              activeTab === 'dashboard' ? "text-white" : "text-brand-gray"
            )}
          >
            <LayoutDashboard className={clsx(
              "w-6 h-6 lg:w-5 lg:h-5 transition-all group-hover:scale-110",
              activeTab === 'dashboard' && "text-brand-blue drop-shadow-[0_0_8px_rgba(50,173,230,0.5)]"
            )} />
            <span className="text-[10px] lg:text-sm font-medium">Painel Inicial</span>
          </button>
        )}

        {userRole === 'paciente' && (
          <button
            onClick={() => setActiveTab('ultra')}
            className={clsx(
              "flex flex-col lg:flex-row items-center lg:justify-start gap-1 lg:gap-3 p-2 lg:px-4 lg:py-3 rounded-xl hover:bg-white/5 w-full transition-all group mt-auto md:mb-4 border border-transparent hover:border-brand-gold/30",
              activeTab === 'ultra' ? "text-white" : "text-brand-gray"
            )}
          >
            <Sparkles className={clsx(
              "w-6 h-6 lg:w-5 lg:h-5 transition-all group-hover:scale-110",
              activeTab === 'ultra' ? "text-brand-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" : "text-brand-gold/70"
            )} />
            <span className="text-[10px] lg:text-sm font-medium text-gradient-gold">Ultra+</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('profile')}
          className={clsx(
            "flex flex-col lg:flex-row items-center lg:justify-start gap-1 lg:gap-3 p-2 lg:px-4 lg:py-3 rounded-xl hover:bg-white/5 w-full transition-all group border border-transparent",
            activeTab === 'profile' ? "text-white bg-white/5 border-white/10" : "text-brand-gray mt-2"
          )}
        >
          <UserCog className={clsx(
            "w-6 h-6 lg:w-5 lg:h-5 transition-all group-hover:scale-110",
            activeTab === 'profile' && "text-white"
          )} />
          <span className="text-[10px] lg:text-sm font-medium">Meu Perfil</span>
        </button>

        {/* Mobile Logout Button */}
        <button 
          onClick={onLogout}
          className="md:hidden flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-brand-gray hover:text-red-400 mt-2"
        >
          <LogOut className="w-6 h-6 transition-all" />
          <span className="text-[10px] font-medium">Sair</span>
        </button>
      </div>
      
      {/* User Profile Mini */}
      <div className="hidden md:flex flex-col lg:px-4 mt-auto w-full border-t border-white/10 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <img src="https://ui-avatars.com/api/?name=User&background=1C1C1E&color=fff" alt="User" className="w-10 h-10 rounded-full border border-white/20" />
          <div className="hidden lg:block">
            <p className="text-sm font-medium leading-tight">
              {userRole === 'admin' ? 'Administrador' : userRole === 'medico' ? 'Dr. Médico' : 'Paciente'}
            </p>
            <p className="text-[10px] text-brand-gray uppercase">{userRole || 'Usuário'}</p>
          </div>
        </div>
        
        <button 
          onClick={onLogout}
          className="flex items-center justify-center lg:justify-start gap-2 p-2 rounded-xl hover:bg-red-500/10 text-brand-gray hover:text-red-400 transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-medium hidden lg:block">Sair do Sistema</span>
        </button>
      </div>
    </nav>
  );
}
