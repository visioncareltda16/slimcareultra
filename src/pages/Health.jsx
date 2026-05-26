import { useState, useEffect } from 'react';
import { Scale, Info, Loader2, Save, Activity } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { PhotoGallery } from '../components/patient/PhotoGallery';
import { ExamsManager } from '../components/patient/ExamsManager';

export function Health({ currentUser }) {
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [dataRegistro, setDataRegistro] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [historico, setHistorico] = useState([]);
  const [loadingHist, setLoadingHist] = useState(true);

  useEffect(() => {
    const fetchHistorico = async () => {
      if (!currentUser?.uid) return;
      try {
        const q = query(
          collection(db, 'pacientes_evolucoes'),
          where('pacienteId', '==', currentUser.uid)
        );
        const snap = await getDocs(q);
        
        // Sort locally to avoid Firestore index requirements
        let data = snap.docs.map(d => d.data()).filter(d => d.data); // Ensure data exists
        data.sort((a, b) => new Date(b.data) - new Date(a.data));
        data = data.slice(0, 5); // keep only top 5

        setHistorico(data);
        
        // Auto-fill height and weight if exists
        if (data.length > 0) {
          if (data[0].altura) setAltura(data[0].altura);
          if (data[0].peso) setPeso(data[0].peso);
        }
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
      } finally {
        setLoadingHist(false);
      }
    };
    fetchHistorico();
  }, [currentUser]);

  const p = parseFloat(String(peso).replace(',', '.'));
  const a = parseFloat(String(altura).replace(',', '.'));

  let imc = null;
  let classificacao = '';
  let corClassificacao = 'text-brand-gray';
  let pesoIdeal = null;

  if (p > 0 && a > 0) {
    imc = p / (a * a);
    pesoIdeal = 22.5 * (a * a);
    
    if (imc < 18.5) { classificacao = 'Abaixo do peso'; corClassificacao = 'text-yellow-500'; }
    else if (imc >= 18.5 && imc < 25) { classificacao = 'Peso Normal'; corClassificacao = 'text-emerald-500'; }
    else if (imc >= 25 && imc < 30) { classificacao = 'Sobrepeso'; corClassificacao = 'text-orange-400'; }
    else if (imc >= 30 && imc < 35) { classificacao = 'Obesidade Grau I'; corClassificacao = 'text-orange-500'; }
    else if (imc >= 35 && imc < 40) { classificacao = 'Obesidade Grau II'; corClassificacao = 'text-red-500'; }
    else { classificacao = 'Obesidade Grau III'; corClassificacao = 'text-red-600'; }
  }

  const handleSave = async (e) => {
    e.preventDefault();
    if (!p || !a || !currentUser?.uid) return;

    setLoading(true);
    setSuccess(false);

    try {
      const dataIsoStr = new Date(`${dataRegistro}T12:00:00`).toISOString();
      await addDoc(collection(db, 'pacientes_evolucoes'), {
        pacienteId: currentUser.uid,
        peso: p,
        altura: a,
        imc: parseFloat(imc.toFixed(1)),
        pesoIdeal: parseFloat(pesoIdeal.toFixed(1)),
        data: dataIsoStr
      });
      setSuccess(true);
      // Refresh
      const novoHistorico = [{ 
        peso: p, 
        altura: a, 
        imc: parseFloat(imc.toFixed(1)), 
        pesoIdeal: parseFloat(pesoIdeal.toFixed(1)), 
        data: dataIsoStr 
      }, ...historico].sort((x, y) => new Date(y.data) - new Date(x.data)).slice(0, 5);
      setHistorico(novoHistorico);
      // Removed setPeso('') so the input doesn't clear after saving
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert('Houve um erro ao salvar os dados.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '--';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '--';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6 animate-[fadeIn_0.4s_ease-out] max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Formulário */}
        <div className="flex-1 glass-card p-5 md:p-6 flex flex-col border-t-4 border-brand-blue">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-brand-blue/10 rounded-xl text-brand-blue">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Registro Metabólico</h2>
              <p className="text-xs text-brand-gray">Insira seus dados p/ acompanhamento.</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 mb-2">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Data do Registro</label>
              <input 
                type="date" required
                value={dataRegistro} onChange={e => setDataRegistro(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/50" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Peso (kg)</label>
                <input 
                  type="number" step="0.1" required
                  value={peso} onChange={e => setPeso(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/50" 
                  placeholder="Ex: 85.5" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Altura (m)</label>
                <input 
                  type="number" step="0.01" required
                  value={altura} onChange={e => setAltura(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/50" 
                  placeholder="Ex: 1.75" 
                />
              </div>
            </div>

            <button 
              disabled={loading || !peso || !altura} 
              type="submit" 
              className="mt-2 w-full py-3.5 rounded-xl bg-brand-blue text-white font-bold shadow-lg hover:bg-brand-blue/90 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Salvar Registro</>}
            </button>
            
            {success && <p className="text-sm text-emerald-400 text-center font-medium mt-1">Dados salvos com sucesso!</p>}
          </form>

          {/* Resultado IMC */}
          <div className="mt-5 pt-5 border-t border-white/10 flex flex-col gap-3">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div>
                <p className="text-[10px] text-brand-gray uppercase tracking-widest font-semibold mb-0.5">Seu IMC Calculado</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-brand font-bold">{imc ? imc.toFixed(1) : '--'}</span>
                  {imc && <span className={`text-xs font-semibold ${corClassificacao}`}>{classificacao}</span>}
                </div>
              </div>
              <Activity className="w-8 h-8 text-brand-gray opacity-50" />
            </div>

            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 relative group">
              <div>
                <p className="text-[10px] text-brand-gray uppercase tracking-widest font-semibold mb-0.5 flex items-center gap-1.5">
                  Peso Ideal Estimado
                  <div className="cursor-help relative">
                    <Info className="w-3 h-3 text-brand-gray" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#1c1c1e] border border-white/10 rounded-lg text-[10px] text-brand-gray opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                      Cálculo baseado em um IMC alvo de 22.5 (Considerado padrão ouro universal de saudabilidade pela OMS). Fórmula: 22.5 × (Altura)².
                    </div>
                  </div>
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-brand font-bold text-brand-turquoise">{pesoIdeal ? pesoIdeal.toFixed(1) : '--'}</span>
                  <span className="text-xs text-brand-gray">kg</span>
                </div>
              </div>
              <Activity className="w-6 h-6 text-brand-turquoise opacity-20" />
            </div>
          </div>
        </div>

        {/* Histórico */}
        <div className="flex-1 glass-card p-5 md:p-6 flex flex-col">
          <h3 className="text-lg font-semibold mb-5">Últimos Registros</h3>
          
          {loadingHist ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-brand-gray" /></div>
          ) : historico.length === 0 ? (
            <p className="text-sm text-brand-gray">Nenhum registro encontrado. Adicione o seu primeiro registro ao lado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {historico.map((hist, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 rounded-xl bg-black/40 border border-white/5">
                  <p className="text-[10px] text-brand-gray text-center">{formatDate(hist.data)}</p>
                  <div className="grid grid-cols-4 items-center text-center gap-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-brand-gray uppercase font-semibold">Peso</span>
                      <span className="font-semibold text-sm">{hist.peso}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-brand-gray uppercase font-semibold">Altura</span>
                      <span className="font-semibold text-sm">{hist.altura}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-brand-gray uppercase font-semibold">IMC</span>
                      <span className="text-sm font-medium text-brand-blue">{hist.imc}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-brand-gray uppercase font-semibold">Ideal</span>
                      <span className="text-sm font-medium text-brand-turquoise">{hist.pesoIdeal || '--'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Row: Photo Gallery and Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <PhotoGallery currentUser={currentUser} />
        <ExamsManager currentUser={currentUser} />
      </div>

    </div>
  );
}
