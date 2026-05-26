import { useState, useEffect } from 'react';
import { Users, Activity, FileText, AlertTriangle, ChevronRight, Loader2, Settings, Plus, X, Bell } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { PatientRecord } from './PatientRecord';

export function DoctorDashboard({ currentUser }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Symptoms Config
  const [showSymptomsConfig, setShowSymptomsConfig] = useState(false);
  const [sintomas, setSintomas] = useState([]);
  const [newSintoma, setNewSintoma] = useState('');
  const [savingSintomas, setSavingSintomas] = useState(false);

  // Exam Panels State
  const [showExamesConfig, setShowExamesConfig] = useState(false);
  const [paineisExames, setPaineisExames] = useState([
    { nome: 'Checkup Metabólico', exames: ['Hemograma', 'Glicemia em Jejum', 'Insulina', 'Colesterol Total e Frações', 'Triglicerídeos', 'TSH'] },
    { nome: 'Checkup Hormonal', exames: ['Testosterona Total', 'Estradiol', 'Cortisol', 'Prolactina'] }
  ]);
  const [newPainelNome, setNewPainelNome] = useState('');
  const [newPainelExames, setNewPainelExames] = useState('');
  const [savingPaineis, setSavingPaineis] = useState(false);

  useEffect(() => {
    const fetchMyPatients = async () => {
      if (!currentUser?.uid) return;
      try {
        const q = query(
          collection(db, 'pacientes_cadastros'), 
          where('medico', '==', currentUser.uid)
        );
        const snapshot = await getDocs(q);
        
        const patientsList = [];
        
        // 7 days ago string
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        for (const p of snapshot.docs) {
          // Check if user is approved
          const userDoc = await getDoc(doc(db, 'users', p.id));
          if (userDoc.exists() && userDoc.data().status === 'approved') {
            const patData = { uid: p.id, ...p.data(), hasAlert: false };
            
            // Check for recent symptoms (filtering locally to avoid missing Firestore index errors)
            const evtQ = query(collection(db, 'calendario_eventos'), where('pacienteId', '==', p.id));
            const evtSnap = await getDocs(evtQ);
            evtSnap.forEach(e => {
              const data = e.data();
              if (data.data >= sevenDaysAgoStr && data.sintomas && data.sintomas.length > 0) {
                patData.hasAlert = true;
              }
            });

            patientsList.push(patData);
          }
        }
        patientsList.sort((a, b) => (a.nome || a.name || '').localeCompare(b.nome || b.name || ''));
        setPatients(patientsList);
      } catch (error) {
        console.error("Error fetching my patients:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyPatients();

    const fetchConfig = async () => {
      const snapSintomas = await getDoc(doc(db, 'configuracoes_clinica', 'sintomas'));
      if (snapSintomas.exists() && snapSintomas.data().lista) {
        setSintomas(snapSintomas.data().lista);
      }
      const snapExames = await getDoc(doc(db, 'configuracoes_clinica', 'exames_paineis'));
      if (snapExames.exists() && snapExames.data().lista) {
        setPaineisExames(snapExames.data().lista);
      }
    };
    fetchConfig();
  }, [currentUser]);

  const handleAddSintoma = (e) => {
    e.preventDefault();
    if (!newSintoma.trim() || sintomas.includes(newSintoma.trim())) return;
    setSintomas([...sintomas, newSintoma.trim()]);
    setNewSintoma('');
  };

  const handleRemoveSintoma = (s) => {
    setSintomas(sintomas.filter(item => item !== s));
  };

  const handleSaveSintomas = async () => {
    setSavingSintomas(true);
    try {
      await setDoc(doc(db, 'configuracoes_clinica', 'sintomas'), {
        lista: sintomas,
        updatedAt: new Date().toISOString()
      });
      setShowSymptomsConfig(false);
    } catch (error) {
      alert("Erro ao salvar configuração.");
    } finally {
      setSavingSintomas(false);
    }
  };

  const handleAddPainel = (e) => {
    e.preventDefault();
    if (!newPainelNome.trim() || !newPainelExames.trim()) return;
    
    const examesArray = newPainelExames.split(',').map(ex => ex.trim()).filter(ex => ex);
    setPaineisExames([...paineisExames, { nome: newPainelNome.trim(), exames: examesArray }]);
    setNewPainelNome('');
    setNewPainelExames('');
  };

  const handleRemovePainel = (nome) => {
    setPaineisExames(paineisExames.filter(p => p.nome !== nome));
  };

  const handleSavePaineis = async () => {
    setSavingPaineis(true);
    try {
      await setDoc(doc(db, 'configuracoes_clinica', 'exames_paineis'), {
        lista: paineisExames,
        updatedAt: new Date().toISOString()
      });
      setShowExamesConfig(false);
    } catch (error) {
      alert("Erro ao salvar configuração de exames.");
    } finally {
      setSavingPaineis(false);
    }
  };

  if (selectedPatient) {
    return <PatientRecord patient={selectedPatient} onBack={() => setSelectedPatient(null)} />;
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-brand font-light">Olá, <span className="font-bold">{currentUser?.nome || currentUser?.name || 'Médico'}</span></h2>
          <p className="text-sm text-brand-gray">Resumo clínico dos seus pacientes em acompanhamento.</p>
        </div>
          <button 
            onClick={() => setShowSymptomsConfig(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs md:text-sm font-semibold transition-all"
          >
            <Settings className="w-4 h-4" /> Sintomas
          </button>
          <button 
            onClick={() => setShowExamesConfig(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs md:text-sm font-semibold transition-all"
          >
            <Activity className="w-4 h-4" /> Exames (Painéis)
          </button>
        <button className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition text-sm flex items-center gap-2">
          <Users className="w-4 h-4" /> Novo Prontuário
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Alerta Card */}
        <div className="glass-card p-5 flex flex-col border-l-4 border-rose-500">
          <div className="flex justify-between items-start mb-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">Atenção</span>
          </div>
          <h3 className="text-lg font-bold mt-2">0 Pacientes</h3>
          <p className="text-xs text-brand-gray mt-1">Com níveis de Glicemia fora da meta semanal.</p>
        </div>
        
        <div className="glass-card p-5 flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <Activity className="w-5 h-5 text-brand-blue" />
          </div>
          <h3 className="text-lg font-bold mt-2">{patients.length} Ativos</h3>
          <p className="text-xs text-brand-gray mt-1">Pacientes sob sua responsabilidade.</p>
        </div>

        <div className="glass-card p-5 flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <FileText className="w-5 h-5 text-brand-turquoise" />
          </div>
          <h3 className="text-lg font-bold mt-2">0 Relatórios IA</h3>
          <p className="text-xs text-brand-gray mt-1">Análises metabólicas geradas hoje.</p>
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col">
        <h3 className="text-lg font-semibold mb-6">Meus Pacientes</h3>
        
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-brand-gray" /></div>
        ) : patients.length === 0 ? (
          <p className="text-sm text-brand-gray">Nenhum paciente ativo vinculado ao seu perfil ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {patients.map((patient, i) => (
              <div 
                key={patient.uid} 
                onClick={() => setSelectedPatient(patient)}
                className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-black border border-white/10 flex items-center justify-center text-xs font-bold text-brand-gray uppercase">
                    {(patient.name || patient.nome || 'P').charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{patient.name || patient.nome}</h4>
                    <p className="text-xs text-brand-gray mt-0.5">{patient.cpf} • {patient.nascimento}</p>
                  </div>
                </div>
                
                <div className="hidden md:flex items-center gap-8">
                  {patient.hasAlert && (
                    <div className="flex items-center gap-1.5 text-brand-gold animate-pulse">
                      <Bell className="w-4 h-4 fill-brand-gold" />
                      <span className="text-[10px] font-bold uppercase">Sintomas Recentes</span>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-xs text-brand-gray mb-1">Status</p>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full text-brand-turquoise bg-brand-turquoise/10">Ativo</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-brand-gray group-hover:text-white transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Symptoms Config Modal */}
      {showSymptomsConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSymptomsConfig(false)}></div>
          <div className="bg-[#121215] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-lg z-10 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Configurar Sintomas</h3>
              <button onClick={() => setShowSymptomsConfig(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            
            <p className="text-sm text-brand-gray mb-6">Estes botões aparecerão no Diário Clínico de todos os seus pacientes para relato rápido.</p>

            <form onSubmit={handleAddSintoma} className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={newSintoma} onChange={e => setNewSintoma(e.target.value)}
                placeholder="Ex: Tontura Forte"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-gold"
              />
              <button type="submit" className="px-4 py-2 bg-brand-gold text-black font-bold rounded-xl hover:bg-brand-gold/90"><Plus className="w-4 h-4" /></button>
            </form>

            <div className="flex flex-wrap gap-2 mb-8 max-h-60 overflow-y-auto">
              {sintomas.map(s => (
                <div key={s} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm flex items-center gap-2">
                  <span>{s}</span>
                  <button onClick={() => handleRemoveSintoma(s)} className="text-white/40 hover:text-red-400"><X className="w-3 h-3" /></button>
                </div>
              ))}
              {sintomas.length === 0 && <span className="text-sm text-brand-gray">Nenhum sintoma cadastrado.</span>}
            </div>

            <button 
              onClick={handleSaveSintomas}
              disabled={savingSintomas}
              className="w-full py-4 bg-brand-blue text-white font-bold rounded-xl hover:bg-brand-blue/90 disabled:opacity-50 flex justify-center items-center"
            >
              {savingSintomas ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Lista Global'}
            </button>
          </div>
        </div>
      )}

      {/* Exam Panels Config Modal */}
      {showExamesConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowExamesConfig(false)}></div>
          <div className="bg-[#121215] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-2xl z-10 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Painéis de Exames</h3>
              <button onClick={() => setShowExamesConfig(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            
            <p className="text-sm text-brand-gray mb-6">Crie painéis de exames (ex: "Checkup Inicial") para facilitar a solicitação rápida nos prontuários.</p>

            <form onSubmit={handleAddPainel} className="flex flex-col gap-3 mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
              <input 
                type="text" required
                value={newPainelNome} onChange={e => setNewPainelNome(e.target.value)}
                placeholder="Nome do Painel (Ex: Rotina Básica)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <textarea 
                required
                value={newPainelExames} onChange={e => setNewPainelExames(e.target.value)}
                placeholder="Lista de exames separados por vírgula (Ex: Hemograma, Insulina, Glicemia)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none h-20"
              />
              <button type="submit" className="self-end px-4 py-2 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> Criar Painel
              </button>
            </form>

            <div className="flex flex-col gap-3 mb-8 max-h-60 overflow-y-auto pr-2">
              {paineisExames.map(p => (
                <div key={p.nome} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm text-purple-400">{p.nome}</h4>
                    <button onClick={() => handleRemovePainel(p.nome)} className="text-white/40 hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.exames.map(ex => (
                      <span key={ex} className="text-[10px] bg-white/10 px-2 py-1 rounded-md text-brand-gray">{ex}</span>
                    ))}
                  </div>
                </div>
              ))}
              {paineisExames.length === 0 && <span className="text-sm text-brand-gray">Nenhum painel cadastrado.</span>}
            </div>

            <button 
              onClick={handleSavePaineis}
              disabled={savingPaineis}
              className="w-full py-4 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 disabled:opacity-50 flex justify-center items-center"
            >
              {savingPaineis ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Configurações de Exames'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
