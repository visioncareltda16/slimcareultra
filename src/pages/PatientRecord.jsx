import { useState, useEffect } from 'react';
import { ArrowLeft, Target, Activity, Zap, Loader2, Pill, Save, Sparkles, X, Bell, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, getDoc, doc, setDoc, addDoc } from 'firebase/firestore';
import { Journey } from './Journey';

export function PatientRecord({ patient, onBack }) {
  const [loading, setLoading] = useState(true);
  const [historico, setHistorico] = useState([]);
  
  // Forms states
  const [metaPeso, setMetaPeso] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  
  const [protocolo, setProtocolo] = useState({ medicamento: '', dose: '', periodicidade: '' });
  const [savingProtocolo, setSavingProtocolo] = useState(false);

  const medicamentos = [
    'Tirzepatida (Mounjaro)',
    'Semaglutida (Ozempic/Wegovy)',
    'Liraglutida (Saxenda)',
    'Dulaglutida (Trulicity)',
    'Sibutramina',
    'Orlistate',
    'Outro'
  ];

  // Exams state
  const [paineisDisponiveis, setPaineisDisponiveis] = useState([]);
  const [examesPendentes, setExamesPendentes] = useState([]);
  const [newExameAvulso, setNewExameAvulso] = useState('');
  const [savingExames, setSavingExames] = useState(false);
  const [examesEnviados, setExamesEnviados] = useState([]);

  // AI Report State
  const [iaReport, setIaReport] = useState(null);
  const [generatingIa, setGeneratingIa] = useState(false);

  // Alertas Médicos State
  const [alertaTexto, setAlertaTexto] = useState('');
  const [savingAlerta, setSavingAlerta] = useState(false);
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const pUid = patient.uid;
        
        // Prepare queries
        const qEvolucao = query(collection(db, 'pacientes_evolucoes'), where('pacienteId', '==', pUid));
        const pCadastro = getDoc(doc(db, 'pacientes_cadastros', pUid));
        const pProtocolo = getDoc(doc(db, 'protocolos_tratamento', pUid));
        const pPaineis = getDoc(doc(db, 'configuracoes_clinica', 'exames_paineis'));
        const qAlertas = query(collection(db, 'alertas_medicos'), where('pacienteId', '==', pUid));
        const qExames = query(collection(db, 'pacientes_exames'), where('pacienteId', '==', pUid));

        // Execute all in parallel
        const [
          snapEvolucao,
          docCadastro,
          docProtocolo,
          docPaineis,
          snapAlertas,
          snapExamesUploads
        ] = await Promise.all([
          getDocs(qEvolucao),
          pCadastro,
          pProtocolo,
          pPaineis,
          getDocs(qAlertas),
          getDocs(qExames)
        ]);

        // Process Evolução
        let histData = snapEvolucao.docs.map(d => d.data()).filter(d => d.data);
        histData.sort((a, b) => new Date(a.data) - new Date(b.data));
        setHistorico(histData);

        // Process Dados Clínicos
        if (docCadastro.exists()) {
          const cData = docCadastro.data();
          if (cData.metaPeso) setMetaPeso(cData.metaPeso);
          if (cData.exames_pendentes) setExamesPendentes(cData.exames_pendentes);
        }

        // Process Protocolo
        if (docProtocolo.exists()) {
          setProtocolo(docProtocolo.data());
        }

        // Process Painéis
        if (docPaineis.exists() && docPaineis.data().lista) {
          setPaineisDisponiveis(docPaineis.data().lista);
        }

        // Process Alertas
        let alertasData = snapAlertas.docs.map(d => d.data());
        alertasData.sort((a, b) => new Date(b.data) - new Date(a.data));
        setAlertas(alertasData);

        // Process Exames
        let examesData = snapExamesUploads.docs.map(d => ({ id: d.id, ...d.data() }));
        examesData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setExamesEnviados(examesData);

      } catch (error) {
        console.error("Erro ao carregar prontuário:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPatientData();
  }, [patient]);

  const handleSaveMeta = async (e) => {
    e.preventDefault();
    setSavingMeta(true);
    try {
      await setDoc(doc(db, 'pacientes_cadastros', patient.uid), {
        metaPeso: parseFloat(metaPeso)
      }, { merge: true });
      alert('Meta salva com sucesso!');
    } catch (e) {
      alert('Erro ao salvar meta.');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveProtocolo = async (e) => {
    e.preventDefault();
    setSavingProtocolo(true);
    try {
      await setDoc(doc(db, 'protocolos_tratamento', patient.uid), {
        medicamento: protocolo.medicamento,
        dose: protocolo.dose,
        periodicidade: protocolo.periodicidade,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert('Protocolo farmacológico atualizado!');
    } catch (e) {
      alert('Erro ao atualizar protocolo.');
    } finally {
      setSavingProtocolo(false);
    }
  };

  const handleAddPainel = async (painel) => {
    const novosExames = [...new Set([...examesPendentes, ...painel.exames])];
    await saveExames(novosExames);
  };

  const handleAddExameAvulso = async (e) => {
    e.preventDefault();
    if (!newExameAvulso.trim()) return;
    const novosExames = [...new Set([...examesPendentes, newExameAvulso.trim()])];
    await saveExames(novosExames);
    setNewExameAvulso('');
  };

  const handleRemoveExame = async (exame) => {
    const novosExames = examesPendentes.filter(e => e !== exame);
    await saveExames(novosExames);
  };

  const saveExames = async (lista) => {
    setSavingExames(true);
    try {
      await setDoc(doc(db, 'pacientes_cadastros', patient.uid), {
        exames_pendentes: lista
      }, { merge: true });
      setExamesPendentes(lista);
    } catch (e) {
      alert('Erro ao atualizar exames.');
    } finally {
      setSavingExames(false);
    }
  };

  const handleSendAlerta = async (e) => {
    e.preventDefault();
    if (!alertaTexto.trim()) return;
    setSavingAlerta(true);
    try {
      const novoAlerta = {
        pacienteId: patient.uid,
        texto: alertaTexto.trim(),
        data: new Date().toISOString()
      };
      await addDoc(collection(db, 'alertas_medicos'), novoAlerta);
      setAlertas([novoAlerta, ...alertas]);
      setAlertaTexto('');
      alert('Alerta enviado com sucesso!');
    } catch (e) {
      alert('Erro ao enviar alerta.');
    } finally {
      setSavingAlerta(false);
    }
  };

  const generateIaReport = async () => {
    setGeneratingIa(true);
    try {
      // Puxar eventos dos últimos 30 dias (simulado puxando todos e filtrando)
      const q = query(collection(db, 'calendario_eventos'), where('pacienteId', '==', patient.uid));
      const snap = await getDocs(q);
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];

      let totalAplicacoes = 0;
      let sintomasCount = {};
      
      snap.forEach(d => {
        const data = d.data();
        if (data.data >= thirtyStr) {
          if (data.aplicacoes && data.aplicacoes.length > 0) totalAplicacoes++;
          if (data.sintomas) {
            data.sintomas.forEach(s => {
              sintomasCount[s] = (sintomasCount[s] || 0) + 1;
            });
          }
        }
      });

      // Peso Perdido
      let pesoTxt = "Ainda não há registros suficientes de peso para avaliar a evolução.";
      if (historico.length >= 2) {
        const pInicial = historico[0].peso;
        const pAtual = historico[historico.length - 1].peso;
        const diff = (pInicial - pAtual).toFixed(1);
        if (diff > 0) pesoTxt = `Paciente apresentou perda de peso de ${diff}kg.`;
        else if (diff < 0) pesoTxt = `Paciente apresentou ganho de peso de ${Math.abs(diff)}kg.`;
        else pesoTxt = "Peso se manteve estável.";
      } else if (historico.length === 1) {
        pesoTxt = `Paciente tem apenas o peso inicial registrado (${historico[0].peso}kg).`;
      }

      // Sintomas Mais Frequentes
      const sortedSintomas = Object.entries(sintomasCount).sort((a,b) => b[1] - a[1]);
      let sintomasTxt = "Não relatou efeitos colaterais ou sintomas nos últimos 30 dias.";
      if (sortedSintomas.length > 0) {
        sintomasTxt = `Principais sintomas relatados: ${sortedSintomas.map(s => `${s[0]} (${s[1]}x)`).join(', ')}.`;
      }

      // Medicação
      let medTxt = `Registrou ${totalAplicacoes} aplicações de medicação nos últimos 30 dias.`;
      if (totalAplicacoes === 0) medTxt = "Não há registros de aplicação de medicação nos últimos 30 dias.";

      const report = `**Resumo Clínico (Últimos 30 dias):**\n\n${pesoTxt}\n\n${medTxt}\n\n${sintomasTxt}\n\n*Atenção: Este é um resumo automático para auxiliar a consulta. Avalie o histórico completo.*`;
      
      setTimeout(() => {
        setIaReport(report);
        setGeneratingIa(false);
      }, 1500); // Simulando delay de processamento IA

    } catch (e) {
      alert("Erro ao gerar relatório.");
      setGeneratingIa(false);
    }
  };

  // Charts Config
  const chartLabels = historico.map(h => {
    const d = new Date(h.data);
    return !isNaN(d.getTime()) ? `${d.getDate()}/${d.getMonth()+1}` : '--';
  });
  
  const chartDataPoints = historico.map(h => h.peso);
  const chartImcPoints = historico.map(h => h.imc);
  const pesoIdealAtual = historico.length > 0 ? historico[historico.length - 1].pesoIdeal : null;

  // Chart 1: Peso
  const chartDataPeso = {
    labels: chartLabels.length > 0 ? chartLabels : ['Sem dados'],
    datasets: [
      {
        label: 'Peso Atual (kg)',
        data: chartDataPoints.length > 0 ? chartDataPoints : [0],
        borderColor: '#32ADE6',
        backgroundColor: 'rgba(50, 173, 230, 0.2)',
        borderWidth: 3,
        pointBackgroundColor: '#1C1C1E',
        pointBorderColor: '#32ADE6',
        pointBorderWidth: 2,
        pointRadius: 4,
        fill: true,
        tension: 0.4,
      }
    ]
  };

  if (metaPeso && chartLabels.length > 0) {
    chartDataPeso.datasets.push({
      label: 'Peso Alvo',
      data: Array(chartLabels.length).fill(parseFloat(metaPeso)),
      borderColor: '#D4AF37', // Gold
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false
    });
  }

  if (pesoIdealAtual && chartLabels.length > 0) {
    chartDataPeso.datasets.push({
      label: 'Peso Ideal',
      data: Array(chartLabels.length).fill(parseFloat(pesoIdealAtual)),
      borderColor: '#30D158', // Green
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false
    });
  }

  const chartOptionsPeso = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top', labels: { color: '#8E8E93', boxWidth: 12, font: { family: 'Inter', size: 11 } } } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, ticks: { color: '#8E8E93', font: { family: 'Inter', size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, ticks: { color: '#8E8E93', font: { family: 'Inter', size: 11 } } }
    }
  };

  // Chart 2: IMC
  const chartDataImc = {
    labels: chartLabels.length > 0 ? chartLabels : ['Sem dados'],
    datasets: [
      {
        label: 'IMC',
        data: chartImcPoints.length > 0 ? chartImcPoints : [0],
        borderColor: '#BF5AF2', // Purple
        backgroundColor: 'rgba(191, 90, 242, 0.2)',
        borderWidth: 3,
        pointBackgroundColor: '#1C1C1E',
        pointBorderColor: '#BF5AF2',
        pointBorderWidth: 2,
        pointRadius: 4,
        fill: true,
        tension: 0.4,
      }
    ]
  };

  if (chartLabels.length > 0) {
    chartDataImc.datasets.push({
      label: 'IMC Ideal (22.5)',
      data: Array(chartLabels.length).fill(22.5),
      borderColor: '#30D158',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false
    });
  }

  const chartOptionsImc = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top', labels: { color: '#8E8E93', boxWidth: 12, font: { family: 'Inter', size: 11 } } } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, ticks: { color: '#8E8E93', font: { family: 'Inter', size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, ticks: { color: '#8E8E93', font: { family: 'Inter', size: 11 } } }
    }
  };

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-blue" /></div>;
  }

  const pesoAtual = historico.length > 0 ? historico[historico.length - 1].peso : '--';

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease-out]">
      <button 
        onClick={onBack}
        className="self-start flex items-center gap-2 text-brand-gray hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">Voltar aos Pacientes</span>
      </button>

      <div className="glass-card p-6 border-l-4 border-brand-turquoise">
        <h2 className="text-2xl font-brand font-bold">{patient.nome || patient.name}</h2>
        <p className="text-sm text-brand-gray mt-1">CPF: {patient.cpf || 'Não informado'} • Nascimento: {patient.nascimento || 'Não informado'}</p>
        <p className="text-sm text-brand-gray mt-1">{patient.cidade} - {patient.estado}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Lado Esquerdo: Metas e Protocolos */}
        <div className="flex flex-col gap-6">
          
          {/* Análise IA */}
          <div className="glass-card p-6 bg-gradient-to-br from-[#1a1a1f] to-brand-blue/5 border-brand-blue/20 border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-brand-blue">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-semibold uppercase tracking-wider text-sm">Inteligência Clínica (IA)</h3>
              </div>
            </div>
            
            {!iaReport ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-brand-gray">Gere um relatório automático cruzando os dados de peso, sintomas e aplicações dos últimos 30 dias.</p>
                <button 
                  onClick={generateIaReport}
                  disabled={generatingIa}
                  className="px-4 py-2 bg-brand-blue/20 text-brand-blue font-bold rounded-xl hover:bg-brand-blue/30 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {generatingIa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generatingIa ? 'Analisando Dados...' : 'Gerar Relatório 30 Dias'}
                </button>
              </div>
            ) : (
              <div className="bg-black/20 p-4 rounded-xl border border-white/5 text-sm leading-relaxed whitespace-pre-line relative">
                <button onClick={() => setIaReport(null)} className="absolute top-3 right-3 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
                {iaReport}
              </div>
            )}
          </div>

          {/* Meta Científica */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-brand-blue/10 text-brand-blue"><Target className="w-5 h-5" /></div>
              <h3 className="font-semibold">Meta de Peso</h3>
            </div>
            
            <form onSubmit={handleSaveMeta} className="flex gap-3">
              <input 
                type="number" step="0.1" required
                value={metaPeso} onChange={e => setMetaPeso(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue" 
                placeholder="Ex: 75.0 kg" 
              />
              <button disabled={savingMeta} type="submit" className="px-4 py-2 rounded-xl bg-brand-blue text-white font-bold hover:bg-brand-blue/90 disabled:opacity-50">
                {savingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </button>
            </form>
          </div>

          {/* Protocolo Farmacológico */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-brand-turquoise/10 text-brand-turquoise"><Pill className="w-5 h-5" /></div>
              <h3 className="font-semibold">Protocolo Farmacológico</h3>
            </div>
            
            <form onSubmit={handleSaveProtocolo} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-brand-gray uppercase font-semibold">Medicamento</label>
                <select 
                  required
                  value={protocolo.medicamento} onChange={e => setProtocolo({...protocolo, medicamento: e.target.value})}
                  className="bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-turquoise"
                >
                  <option value="">Selecione...</option>
                  {medicamentos.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-brand-gray uppercase font-semibold">Dose</label>
                <input 
                  type="text" required
                  value={protocolo.dose} onChange={e => setProtocolo({...protocolo, dose: e.target.value})}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-turquoise" 
                  placeholder="Ex: 2.5mg" 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-brand-gray uppercase font-semibold">Periodicidade</label>
                <select 
                  required
                  value={protocolo.periodicidade} onChange={e => setProtocolo({...protocolo, periodicidade: e.target.value})}
                  className="bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-turquoise"
                >
                  <option value="">Selecione...</option>
                  <option value="Diário">Diário</option>
                  <option value="Semanal">Semanal</option>
                  <option value="A cada 15 dias">A cada 15 dias</option>
                  <option value="Mensal">Mensal</option>
                </select>
              </div>

              <button disabled={savingProtocolo} type="submit" className="mt-2 py-3 rounded-xl bg-brand-turquoise text-white font-bold hover:bg-brand-turquoise/90 disabled:opacity-50">
                {savingProtocolo ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Atualizar Protocolo'}
              </button>
            </form>
          </div>

          {/* Solicitação de Exames */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400"><Activity className="w-5 h-5" /></div>
              <h3 className="font-semibold">Solicitação de Exames</h3>
            </div>
            
            {/* Painéis Rápidos */}
            <div className="mb-4">
              <label className="text-xs text-brand-gray uppercase font-semibold mb-2 block">Painéis Rápidos</label>
              <div className="flex flex-wrap gap-2">
                {paineisDisponiveis.map(p => (
                  <button 
                    key={p.nome}
                    onClick={() => handleAddPainel(p)}
                    disabled={savingExames}
                    className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold rounded-lg hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                  >
                    + {p.nome}
                  </button>
                ))}
                {paineisDisponiveis.length === 0 && <span className="text-xs text-brand-gray">Nenhum painel configurado.</span>}
              </div>
            </div>

            {/* Exame Avulso */}
            <form onSubmit={handleAddExameAvulso} className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newExameAvulso} onChange={e => setNewExameAvulso(e.target.value)}
                className="flex-1 bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" 
                placeholder="Exame avulso..." 
              />
              <button disabled={savingExames} type="submit" className="px-4 py-2 rounded-xl bg-purple-500 text-white font-bold hover:bg-purple-600 disabled:opacity-50">
                Add
              </button>
            </form>

            {/* Lista Atual */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-brand-gray uppercase font-semibold">Exames Pendentes de Realização</label>
              {examesPendentes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {examesPendentes.map(ex => (
                    <div key={ex} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs flex items-center gap-2">
                      <span>{ex}</span>
                      <button onClick={() => handleRemoveExame(ex)} className="text-white/40 hover:text-red-400"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-gray italic">Nenhum exame solicitado no momento.</p>
              )}
            </div>
          </div>

        </div>

        {/* Lado Direito: Alertas Médicos */}
        <div className="flex flex-col gap-6">
          <div className="glass-card p-6 flex flex-col border-t-4 border-yellow-500 flex-1">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-500"><Bell className="w-5 h-5" /></div>
                <h3 className="font-semibold">Alertas Médicos</h3>
              </div>
            </div>
            
            <form onSubmit={handleSendAlerta} className="flex flex-col gap-2 mb-6">
              <label className="text-xs text-brand-gray uppercase font-semibold">Novo Alerta Direto para o Paciente</label>
              <textarea
                required
                value={alertaTexto} onChange={e => setAlertaTexto(e.target.value)}
                placeholder="Ex: Por favor, aumente a ingestão de água para 3L diários..."
                className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 min-h-[80px] resize-none"
              />
              <button 
                disabled={savingAlerta || !alertaTexto.trim()} 
                type="submit" 
                className="py-2.5 rounded-xl bg-yellow-600 text-white font-bold hover:bg-yellow-500 disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {savingAlerta ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Alerta ao App do Paciente'}
              </button>
            </form>

            <div>
              <label className="text-xs text-brand-gray uppercase font-semibold mb-2 block">Histórico de Alertas</label>
              {alertas.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {alertas.map((alerta, i) => {
                    const d = new Date(alerta.data);
                    const dataFormatada = !isNaN(d.getTime()) ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d) : '--';
                    return (
                      <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-xl text-sm">
                        <p className="text-xs text-brand-gray mb-1">{dataFormatada}</p>
                        <p className="text-white/90">{alerta.texto}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-brand-gray italic">Nenhum alerta enviado.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Arquivos do Paciente (Exames) */}
      <div className="grid grid-cols-1 gap-6 mb-6">


        <div className="glass-card p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-brand-turquoise/10 text-brand-turquoise"><FileText className="w-5 h-5" /></div>
            <h3 className="font-semibold">Exames e Laudos Anexados</h3>
          </div>
          {examesEnviados.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8">
              <p className="text-sm text-brand-gray">Nenhum exame anexado.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
              {examesEnviados.map(exame => (
                <div key={exame.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-brand-turquoise" />
                    <div>
                      <p className="text-xs font-medium line-clamp-1">{exame.nomeArquivo}</p>
                      <p className="text-[10px] text-brand-gray">{new Date(exame.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <a href={exame.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md bg-black/40 hover:bg-black/60 text-brand-gray hover:text-white transition-colors" title="Abrir PDF">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gráficos em Linha (Side by Side) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-blue/10 text-brand-blue"><Activity className="w-5 h-5" /></div>
              <div>
                <h3 className="font-semibold">Evolução do Peso</h3>
                <p className="text-xs text-brand-gray">Peso Atual vs Metas (Alvo e Ideal)</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-brand-gray">Peso Atual</p>
              <p className="font-bold text-lg">{pesoAtual} {pesoAtual !== '--' && 'kg'}</p>
            </div>
          </div>
          <div className="w-full h-64 relative flex-1">
            {historico.length > 0 ? (
              <Line data={chartDataPeso} options={chartOptionsPeso} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-brand-gray text-sm">O paciente ainda não registrou pesos.</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400"><Activity className="w-5 h-5" /></div>
              <div>
                <h3 className="font-semibold">Evolução do IMC</h3>
                <p className="text-xs text-brand-gray">Índice de Massa Corporal</p>
              </div>
            </div>
          </div>
          <div className="w-full h-64 relative flex-1">
            {historico.length > 0 ? (
              <Line data={chartDataImc} options={chartOptionsImc} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-brand-gray text-sm">O paciente ainda não registrou pesos.</p>
              </div>
            )}
          </div>
        </div>



      </div>

      {/* Calendário da Jornada */}
      <div className="mt-4 pt-8 border-t border-white/10">
        <h2 className="text-xl font-bold mb-6">Diário Clínico do Paciente</h2>
        <div className="glass-card p-2 md:p-6 bg-black/40">
          <Journey patientId={patient.uid} readOnly={true} />
        </div>
      </div>
    </div>
  );
}
