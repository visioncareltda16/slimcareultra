import { Sparkles, MessageSquare, ScanLine, BarChart4 } from 'lucide-react';

export function Premium() {
  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="glass-card p-8 md:p-12 border-brand-gold/30 glow-gold relative overflow-hidden flex flex-col items-center text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-gold/10 to-transparent z-0"></div>
        
        <Sparkles className="w-16 h-16 text-brand-gold mb-6 relative z-10 animate-pulse" />
        
        <h2 className="text-3xl md:text-5xl font-brand font-light mb-4 relative z-10">SlimCare <span className="font-bold text-gradient-gold">Ultra+</span></h2>
        <p className="text-lg text-brand-gray max-w-xl mb-10 relative z-10 font-serif-brand italic">O ápice do acompanhamento clínico de alta performance.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full relative z-10">
          <div className="bg-black/50 p-5 rounded-2xl border border-brand-gold/20 backdrop-blur-sm">
            <MessageSquare className="w-6 h-6 text-brand-gold mb-3" />
            <h4 className="font-semibold mb-1">Concierge Médico 24/7</h4>
            <p className="text-xs text-white/60">Acesso direto à equipe multidisciplinar via chat seguro.</p>
          </div>
          <div className="bg-black/50 p-5 rounded-2xl border border-brand-gold/20 backdrop-blur-sm">
            <ScanLine className="w-6 h-6 text-brand-gold mb-3" />
            <h4 className="font-semibold mb-1">Genética Cruzada</h4>
            <p className="text-xs text-white/60">Cruzamento do seu perfil farmacogenético com o tratamento.</p>
          </div>
          <div className="bg-black/50 p-5 rounded-2xl border border-brand-gold/20 backdrop-blur-sm">
            <BarChart4 className="w-6 h-6 text-brand-gold mb-3" />
            <h4 className="font-semibold mb-1">Previsão Preditiva</h4>
            <p className="text-xs text-white/60">Algoritmos que preveem o tempo exato para sua meta final.</p>
          </div>
        </div>
        
        <button className="mt-10 px-8 py-4 bg-gradient-to-r from-brand-gold to-yellow-600 rounded-xl text-black font-bold tracking-wide shadow-lg glow-gold hover:scale-105 transition-all relative z-10">
          Upgrade para Ultra+
        </button>
      </div>
    </div>
  );
}
