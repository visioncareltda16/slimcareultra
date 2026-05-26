import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Syringe, Activity, FileText, Check, Plus, Loader2, Scale } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

export function Journey({ currentUser, patientId, readOnly = false }) {
  const targetUid = patientId || currentUser?.uid;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState({}); // map of YYYY-MM-DD to event data
  const [evolutions, setEvolutions] = useState({}); // map of YYYY-MM-DD to evolucoes
  const [latestAltura, setLatestAltura] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Day panel states
  const [dayData, setDayData] = useState({ sintomas: [], aplicacoes: [], notas: '', exames: [], peso: '', altura: '' });
  const [saving, setSaving] = useState(false);
  const [examesPendentesGlobais, setExamesPendentesGlobais] = useState([]);
  
  // Protocolo from Treatment
  const [protocolo, setProtocolo] = useState(null);
  
  const [sintomasDisponiveis, setSintomasDisponiveis] = useState(['Náusea', 'Dor de Cabeça', 'Cansaço', 'Azia', 'Constipação', 'Insônia', 'Tontura']);

  // Calculate Calendar Grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null); // empty padding
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

  const toISODate = (d) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d - tzOffset)).toISOString().split('T')[0];
  };

  useEffect(() => {
    const fetchMonthData = async () => {
      if (!targetUid) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'calendario_eventos'),
          where('pacienteId', '==', targetUid)
        );
        const snap = await getDocs(q);
        const evts = {};
        snap.forEach(doc => {
          evts[doc.data().data] = doc.data();
        });
        setEvents(evts);

        // Fetch Evolucoes
        const qEvol = query(
          collection(db, 'pacientes_evolucoes'),
          where('pacienteId', '==', targetUid)
        );
        const snapEvol = await getDocs(qEvol);
        const evols = {};
        let alt = '';
        let evolArr = snapEvol.docs.map(d => ({id: d.id, ...d.data()}));
        evolArr.sort((a,b) => new Date(a.data) - new Date(b.data));
        evolArr.forEach(docData => {
          if (docData.data) {
            const dt = docData.data.split('T')[0];
            evols[dt] = docData;
            if (docData.altura) alt = docData.altura;
          }
        });
        setEvolutions(evols);
        setLatestAltura(alt);

        // Fetch Protocolo
        const protSnap = await getDoc(doc(db, 'protocolos_tratamento', targetUid));
        if (protSnap.exists()) {
          setProtocolo(protSnap.data());
        }

        // Fetch Global Symptoms Config
        const sintSnap = await getDoc(doc(db, 'configuracoes_clinica', 'sintomas'));
        if (sintSnap.exists() && sintSnap.data().lista) {
          setSintomasDisponiveis(sintSnap.data().lista);
        }

        // Fetch pending exams
        const pDoc = await getDoc(doc(db, 'pacientes_cadastros', targetUid));
        if (pDoc.exists() && pDoc.data().exames_pendentes) {
          setExamesPendentesGlobais(pDoc.data().exames_pendentes);
        }

      } catch (err) {
        console.error("Erro ao buscar calendário:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMonthData();
  }, [targetUid, month, year]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const openDay = (dateObj) => {
    const dateStr = toISODate(dateObj);
    setSelectedDate(dateStr);
    
    let initialData = { sintomas: [], aplicacoes: [], notas: '', exames: [], peso: '', altura: latestAltura };
    
    if (events[dateStr]) {
      initialData = {
        ...initialData,
        sintomas: events[dateStr].sintomas || [],
        aplicacoes: events[dateStr].aplicacoes || [],
        notas: events[dateStr].notas || '',
        exames: events[dateStr].exames || []
      };
    }
    
    if (evolutions[dateStr]) {
      initialData.peso = evolutions[dateStr].peso || '';
      if (evolutions[dateStr].altura) initialData.altura = evolutions[dateStr].altura;
    }
    
    setDayData(initialData);
  };

  const toggleSintoma = (s) => {
    setDayData(prev => ({
      ...prev,
      sintomas: prev.sintomas.includes(s) 
        ? prev.sintomas.filter(item => item !== s) 
        : [...prev.sintomas, s]
    }));
  };

  const toggleExame = (e) => {
    setDayData(prev => ({
      ...prev,
      exames: prev.exames.includes(e)
        ? prev.exames.filter(item => item !== e)
        : [...prev.exames, e]
    }));
  };

  const registrarAplicacao = () => {
    if (!protocolo) {
      alert("Nenhum protocolo cadastrado pelo médico.");
      return;
    }
    setDayData(prev => ({
      ...prev,
      aplicacoes: [{ medicamento: protocolo.medicamento, dose: protocolo.dose }]
    }));
  };

  const removerAplicacao = () => {
    setDayData(prev => ({ ...prev, aplicacoes: [] }));
  };

  const saveDay = async () => {
    if (!selectedDate || !targetUid || readOnly) return;
    setSaving(true);
    try {
      const docId = `${targetUid}_${selectedDate}`;
      const payload = {
        pacienteId: targetUid,
        data: selectedDate,
        sintomas: dayData.sintomas,
        aplicacoes: dayData.aplicacoes,
        exames: dayData.exames,
        notas: dayData.notas,
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'calendario_eventos', docId), payload);

      // If exames were toggled, remove them from globais (or add back if unchecked)
      // This is a simplified logic: if it's marked today, ensure it's not pending.
      // If the doctor requested it, we just remove it from pending.
      const novosPendentes = examesPendentesGlobais.filter(ex => !dayData.exames.includes(ex));
      if (novosPendentes.length !== examesPendentesGlobais.length) {
        await setDoc(doc(db, 'pacientes_cadastros', targetUid), { exames_pendentes: novosPendentes }, { merge: true });
        setExamesPendentesGlobais(novosPendentes);
      }
      
      // Update or create evolution if peso is provided
      let novoEvolId = null;
      let novaEvolucao = null;
      if (dayData.peso && parseFloat(dayData.peso) > 0) {
        const p = parseFloat(String(dayData.peso).replace(',', '.'));
        const a = parseFloat(String(dayData.altura || latestAltura).replace(',', '.'));
        
        if (p > 0 && a > 0) {
          const imc = p / (a * a);
          const pesoIdeal = 22.5 * (a * a);
          
          novaEvolucao = {
            pacienteId: targetUid,
            peso: p,
            altura: a,
            imc: parseFloat(imc.toFixed(1)),
            pesoIdeal: parseFloat(pesoIdeal.toFixed(1)),
            data: new Date(`${selectedDate}T12:00:00`).toISOString()
          };
          
          if (evolutions[selectedDate]) {
            await setDoc(doc(db, 'pacientes_evolucoes', evolutions[selectedDate].id), novaEvolucao, { merge: true });
            novoEvolId = evolutions[selectedDate].id;
          } else {
            import('firebase/firestore').then(async ({ addDoc }) => {
              const docRef = await addDoc(collection(db, 'pacientes_evolucoes'), novaEvolucao);
              setEvolutions(prev => ({...prev, [selectedDate]: { ...novaEvolucao, id: docRef.id }}));
            });
          }
        }
      }

      // Update local state to reflect dots instantly
      setEvents(prev => ({
        ...prev,
        [selectedDate]: payload
      }));
      
      if (novaEvolucao && novoEvolId) {
         setEvolutions(prev => ({...prev, [selectedDate]: { ...novaEvolucao, id: novoEvolId }}));
      }
      
      setSelectedDate(null);
    } catch (e) {
      alert("Erro ao salvar o dia.");
    } finally {
      setSaving(false);
    }
  };

  const todayStr = toISODate(new Date());

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease-out] relative min-h-[80vh]">
      
      <div className="flex justify-between items-center px-2">
        <h2 className="text-2xl font-semibold capitalize">{monthNames[month]} {year}</h2>
        <div className="flex gap-4 items-center">
          <button className="text-brand-blue font-semibold text-sm hover:opacity-80" onClick={() => {
            setCurrentDate(new Date());
          }}>Hoje</button>
          <div className="flex gap-2">
            <button onClick={handlePrevMonth} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={handleNextMonth} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-blue" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Calendar Side */}
          <div className="glass-card p-4 md:p-6">
            <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDays.map(d => (
              <div key={d} className="text-center text-[10px] md:text-xs font-bold text-brand-gray tracking-widest">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-y-2 gap-x-1 md:gap-x-2">
            {days.map((d, i) => {
              if (!d) return <div key={i} className="h-12 md:h-16"></div>;
              
              const dateStr = toISODate(d);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dayEvts = events[dateStr] || {};
              
              const hasAplicacao = dayEvts.aplicacoes?.length > 0;
              const hasSintomas = dayEvts.sintomas?.length > 0;
              const hasExames = dayEvts.exames?.length > 0;

              return (
                <div 
                  key={i} 
                  onClick={() => openDay(d)}
                  className={`flex flex-col items-center justify-start h-12 md:h-16 rounded-xl cursor-pointer transition-all border-2
                    ${isSelected ? 'bg-white/10 border-white/20' : 'hover:bg-white/5 border-transparent'}
                  `}
                >
                  <div className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full mt-0.5 ${isToday ? 'bg-brand-blue text-white font-bold' : 'text-white'}`}>
                    <span className="text-xl md:text-2xl font-semibold">{d.getDate()}</span>
                  </div>
                  
                  {/* Dots Container */}
                  <div className="flex gap-1 mt-1">
                    {hasAplicacao && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-brand-blue shadow-[0_0_5px_#32ADE6]"></div>}
                    {hasSintomas && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-brand-gold shadow-[0_0_5px_#D4AF37]"></div>}
                    {hasExames && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-purple-500 shadow-[0_0_5px_#A855F7]"></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

          {/* Details Side */}
          <div className="glass-card p-5 md:p-6 flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-xl font-bold">
                {selectedDate 
                  ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                  : 'Selecione um dia'}
              </h3>
            </div>

            {selectedDate ? (
              <>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Peso Card */}
              <div className="glass-card p-5 bg-[#1a1a1f] border-white/5 relative overflow-hidden group">
                <div className="flex items-center gap-2 mb-3 text-brand-blue">
                  <Scale className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Registro de Peso</span>
                </div>
                
                <div className="flex gap-3 mt-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-brand-gray uppercase tracking-widest mb-1 block">Peso (kg)</label>
                    <input 
                      type="number" step="0.1" 
                      value={dayData.peso} onChange={e => setDayData({...dayData, peso: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-blue text-sm" 
                      placeholder="Ex: 85.5" 
                      disabled={readOnly}
                    />
                  </div>
                  <div className="w-1/3">
                    <label className="text-[10px] text-brand-gray uppercase tracking-widest mb-1 block">Altura (m)</label>
                    <input 
                      type="number" step="0.01" 
                      value={dayData.altura} onChange={e => setDayData({...dayData, altura: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-blue text-sm" 
                      placeholder="Ex: 1.75" 
                      disabled={readOnly}
                    />
                  </div>
                </div>
              </div>

              {/* Medicamento Card */}
              <div className="glass-card p-5 bg-[#1a1a1f] border-white/5 relative overflow-hidden group">
                <div className="flex items-center gap-2 mb-3 text-brand-blue">
                  <Syringe className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Injeção</span>
                </div>
                
                {dayData.aplicacoes.length > 0 ? (
                  <div className="flex justify-between items-end">
                    <div>
                      <h4 className="text-lg font-bold">{dayData.aplicacoes[0].medicamento}</h4>
                      <span className="text-xs bg-brand-blue/20 text-brand-blue px-2 py-1 rounded-md mt-1 inline-block font-semibold">
                        {dayData.aplicacoes[0].dose}
                      </span>
                    </div>
                    <button onClick={removerAplicacao} className="text-xs text-red-400 hover:text-red-300 underline">Desfazer</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-brand-gray">Nenhuma aplicação registrada hoje.</p>
                    <button onClick={registrarAplicacao} className="px-4 py-2 bg-brand-blue/20 text-brand-blue rounded-xl text-sm font-semibold hover:bg-brand-blue/30 transition-all">
                      Registrar Dose de {protocolo ? protocolo.medicamento : 'Hoje'}
                    </button>
                  </div>
                )}
              </div>

              {/* Exames Card */}
              <div className="glass-card p-5 bg-[#1a1a1f] border-white/5">
                <div className="flex items-center gap-2 mb-3 text-purple-400">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Exames Solicitados</span>
                </div>
                
                <div className="flex flex-col gap-2">
                  {/* Join pending and done exams for this day to show the full list to toggle */}
                  {Array.from(new Set([...examesPendentesGlobais, ...dayData.exames])).length > 0 ? (
                    Array.from(new Set([...examesPendentesGlobais, ...dayData.exames])).map(ex => {
                      const isDone = dayData.exames.includes(ex);
                      return (
                        <label key={ex} className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" className="hidden" checked={isDone} onChange={() => toggleExame(ex)} />
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${isDone ? 'bg-purple-500 border-purple-500' : 'bg-white/5 border-white/20 group-hover:border-purple-500'}`}>
                            {isDone && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className={`text-sm ${isDone ? 'text-brand-gray line-through' : 'text-white'}`}>{ex}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-sm text-brand-gray">Nenhuma solicitação médica pendente.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sintomas */}
            <div className="glass-card p-5 bg-[#1a1a1f] border-white/5 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-brand-gold">
                <Activity className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Efeitos Colaterais / Sintomas</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {sintomasDisponiveis.map(s => {
                  const isSelected = dayData.sintomas.includes(s);
                  return (
                    <button 
                      key={s}
                      onClick={() => toggleSintoma(s)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 border ${
                        isSelected 
                          ? 'bg-brand-gold text-brand-black border-brand-gold shadow-[0_0_10px_rgba(212,175,55,0.4)]' 
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-white/50" />}
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notas */}
            <div className="glass-card p-5 bg-[#1a1a1f] border-white/5 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-brand-gray">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Notas do Dia</span>
              </div>
              <textarea 
                value={dayData.notas}
                onChange={e => setDayData({...dayData, notas: e.target.value})}
                placeholder="Como foi seu dia? Alimentação, disposição..."
                className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-brand-blue"
                rows={3}
              ></textarea>
            </div>

            {/* Save Button */}
            {!readOnly && (
              <button 
                onClick={saveDay}
                disabled={saving}
                className="w-full py-4 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-all shadow-xl disabled:opacity-50 flex justify-center items-center"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Registros'}
              </button>
            )}
            </>
            ) : (
              <div className="flex-1 flex items-center justify-center py-20 opacity-50">
                <p className="text-sm">Toque em um dia no calendário para ver ou adicionar registros.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
