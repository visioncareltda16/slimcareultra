import { useState, useEffect } from 'react';
import { Activity, Target, Droplet, Zap, Sparkles, Loader2, Bell } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export function Dashboard({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [historico, setHistorico] = useState([]);
  const [metaCientifica, setMetaCientifica] = useState(null);
  const [dosesAplicadas, setDosesAplicadas] = useState(0);
  const [ultimoAlerta, setUltimoAlerta] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser?.uid) return;
      try {
        // Fetch Evolution
        const q = query(
          collection(db, 'pacientes_evolucoes'),
          where('pacienteId', '==', currentUser.uid)
        );
        const snap = await getDocs(q);
        
        // Sort locally to avoid index error
        let data = snap.docs.map(d => d.data()).filter(d => d.data); // Ensure data exists
        data.sort((a, b) => new Date(a.data) - new Date(b.data));
        
        setHistorico(data);

        // Fetch Meta from Protocolos ou Paciente
        // A meta será definida pelo médico na coleção 'protocolos_tratamento' 
        // ou diretamente no documento do paciente. Vamos buscar em pacientes_cadastros por enquanto.
        const pDoc = await getDoc(doc(db, 'pacientes_cadastros', currentUser.uid));
        if (pDoc.exists() && pDoc.data().metaPeso) {
          setMetaCientifica(pDoc.data().metaPeso);
        }

        // Fetch Doses Aplicadas
        const qEvt = query(
          collection(db, 'calendario_eventos'),
          where('pacienteId', '==', currentUser.uid)
        );
        const snapEvt = await getDocs(qEvt);
        let doses = 0;
        snapEvt.forEach(d => {
          if (d.data().aplicacoes && d.data().aplicacoes.length > 0) doses++;
        });
        setDosesAplicadas(doses);

        // Fetch Último Alerta
        const qAlerta = query(
          collection(db, 'alertas_medicos'),
          where('pacienteId', '==', currentUser.uid)
        );
        const snapAlerta = await getDocs(qAlerta);
        let alertasArr = snapAlerta.docs.map(d => d.data());
        if (alertasArr.length > 0) {
          alertasArr.sort((a, b) => new Date(b.data) - new Date(a.data));
          setUltimoAlerta(alertasArr[0]);
        }

      } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [currentUser]);

  // KPIs
  const pesoAtual = historico.length > 0 ? historico[historico.length - 1].peso : '--';
  const imcAtual = historico.length > 0 ? historico[historico.length - 1].imc : '--';
  
  let pesoPerdido = 0;
  if (historico.length > 1) {
    pesoPerdido = historico[0].peso - historico[historico.length - 1].peso;
  }
  const pesoPerdidoStr = pesoPerdido > 0 ? `-${pesoPerdido.toFixed(1)}kg` : (pesoPerdido < 0 ? `+${Math.abs(pesoPerdido).toFixed(1)}kg` : '0kg');

  let diasEmTratamento = 0;
  if (historico.length > 0 && historico[0].data) {
    const dataInicial = new Date(historico[0].data);
    const hoje = new Date();
    const diffTime = Math.abs(hoje - dataInicial);
    if (!isNaN(diffTime)) {
      diasEmTratamento = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
  }

  // Charts
  const chartLabels = historico.map(h => {
    if (!h.data) return '--';
    const d = new Date(h.data);
    if (isNaN(d.getTime())) return '--';
    return `${d.getDate()}/${d.getMonth()+1}`;
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
        borderColor: '#32ADE6', // Base color
        backgroundColor: 'rgba(50, 173, 230, 0.2)', // Base fill
        borderWidth: 3,
        pointBackgroundColor: '#1C1C1E',
        pointBorderColor: '#32ADE6',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  if (metaCientifica && chartLabels.length > 0) {
    chartDataPeso.datasets.push({
      label: 'Peso Alvo',
      data: Array(chartLabels.length).fill(parseFloat(metaCientifica)),
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
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#8E8E93', boxWidth: 12, font: { family: 'Inter', size: 11 } } },
      tooltip: {
        backgroundColor: 'rgba(28, 28, 30, 0.9)',
        titleFont: { family: 'Outfit', size: 13 },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 12,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
        ticks: { color: '#8E8E93', font: { family: 'Inter', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
        ticks: { color: '#8E8E93', font: { family: 'Inter', size: 11 } }
      }
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
      },
    ],
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
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#8E8E93', boxWidth: 12, font: { family: 'Inter', size: 11 } } },
      tooltip: {
        backgroundColor: 'rgba(28, 28, 30, 0.9)',
        titleFont: { family: 'Outfit', size: 13 },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 12,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
        ticks: { color: '#8E8E93', font: { family: 'Inter', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
        ticks: { color: '#8E8E93', font: { family: 'Inter', size: 11 } }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-[fadeIn_0.4s_ease-out] w-full max-w-7xl mx-auto px-4 md:px-6">
      
      {/* Alerta do Médico Banner */}
      {ultimoAlerta && (
        <div className="glass-card p-4 md:p-5 border border-brand-gold/40 bg-brand-gold/5 relative overflow-hidden group shadow-[0_0_20px_rgba(212,175,55,0.1)]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/10 blur-3xl rounded-full"></div>
          <div className="flex items-start gap-4 relative z-10">
            <div className="p-3 rounded-2xl bg-brand-gold/20 text-brand-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]">
              <Bell className="w-6 h-6 animate-[bounce_2s_infinite]" />
            </div>
            <div>
              <p className="text-[10px] text-brand-gold font-bold uppercase tracking-widest mb-1.5 flex items-center gap-2">
                Mensagem do seu Médico
                <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-pulse"></span>
              </p>
              <p className="text-white text-sm md:text-base leading-relaxed font-medium">{ultimoAlerta.texto}</p>
              <p className="text-[10px] text-brand-gray mt-2">
                Enviado em {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ultimoAlerta.data))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Banner Cinematic */}
      <div className="w-full rounded-3xl overflow-hidden relative min-h-[160px] md:min-h-[220px] flex items-center p-6 md:p-10 border border-white/10 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c] to-[#121218] z-0"></div>
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[url('https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=2080&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-screen mask-image-l z-0"></div>
        
        <div className="relative z-10 flex flex-col md:w-2/3">
          <span className="text-brand-blue text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> SlimCare IA
          </span>
          <h2 className="text-2xl md:text-4xl font-brand font-light leading-tight mb-2">Bom dia, <span className="font-bold text-white">{currentUser?.name?.split(' ')[0] || 'Paciente'}</span>.</h2>
          {historico.length > 0 ? (
            <p className="text-sm text-brand-gray max-w-md">Sua evolução está sendo mapeada. Atualize sempre sua aba Inteligência Metabólica.</p>
          ) : (
            <p className="text-sm text-brand-gray max-w-md">Bem-vindo(a) à sua jornada. Acesse a aba Inteligência Metabólica e insira seu primeiro peso.</p>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="glass-card p-5 flex flex-col hover-scale">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 rounded-xl bg-brand-blue/10 text-brand-blue">
              <Activity className="w-5 h-5" />
            </div>
            {historico.length > 1 && (
              <span className="text-xs font-medium text-brand-turquoise bg-brand-turquoise/10 px-2 py-0.5 rounded-full">{pesoPerdidoStr}</span>
            )}
          </div>
          <p className="text-[11px] text-brand-gray uppercase tracking-wider font-semibold mb-1">Peso Atual</p>
          <h3 className="text-2xl font-brand font-bold text-white">{pesoAtual} {pesoAtual !== '--' && <span className="text-sm font-normal text-brand-gray">kg</span>}</h3>
        </div>
        
        {/* Card 2 */}
        <div className="glass-card p-5 flex flex-col hover-scale">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 rounded-xl bg-brand-turquoise/10 text-brand-turquoise">
              <Target className="w-5 h-5" />
            </div>
            {imcAtual !== '--' && (
              <span className="text-xs font-medium text-brand-gray bg-white/5 px-2 py-0.5 rounded-full">IMC {imcAtual}</span>
            )}
          </div>
          <p className="text-[11px] text-brand-gray uppercase tracking-wider font-semibold mb-1">Meta Médica</p>
          <h3 className="text-2xl font-brand font-bold text-white">{metaCientifica ? metaCientifica : '--'} {metaCientifica && <span className="text-sm font-normal text-brand-gray">kg</span>}</h3>
        </div>

        {/* Card 3 */}
        <div className="glass-card p-5 flex flex-col hover-scale relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-blue/10 blur-xl rounded-full"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-2 rounded-xl bg-white/5 text-white">
              <Droplet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-brand-gray uppercase tracking-wider font-semibold mb-1 relative z-10">Doses Aplicadas</p>
          <h3 className="text-2xl font-brand font-bold text-white relative z-10">{dosesAplicadas} <span className="text-sm font-normal text-brand-gray">injeções</span></h3>
        </div>

        {/* Card 4 */}
        <div className="glass-card p-5 flex flex-col hover-scale border-brand-gold/20 glow-gold relative overflow-hidden">
          <div className="absolute right-0 top-0 w-full h-full bg-gradient-to-br from-transparent to-brand-gold/5 z-0"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-2 rounded-xl bg-brand-gold/10 text-brand-gold">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase font-bold text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded-full">Engajamento</span>
          </div>
          <p className="text-[11px] text-brand-gray uppercase tracking-wider font-semibold mb-1 relative z-10">Dias em Tratamento</p>
          <h3 className="text-2xl font-brand font-bold text-gradient-gold relative z-10">{diasEmTratamento}<span className="text-sm font-normal text-brand-gray"> dias</span></h3>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Evolução do Peso</h3>
              <p className="text-xs text-brand-gray">Peso Atual vs Metas (Alvo e Ideal)</p>
            </div>
          </div>
          <div className="w-full h-64 md:h-80 relative">
            {historico.length > 0 ? (
              <Line data={chartDataPeso} options={chartOptionsPeso} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-brand-gray text-sm">Insira seus dados na aba Inteligência Metabólica para gerar o gráfico.</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Evolução do IMC</h3>
              <p className="text-xs text-brand-gray">Índice de Massa Corporal</p>
            </div>
          </div>
          <div className="w-full h-64 md:h-80 relative">
            {historico.length > 0 ? (
              <Line data={chartDataImc} options={chartOptionsImc} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-brand-gray text-sm">Insira seus dados na aba Inteligência Metabólica para gerar o gráfico.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
