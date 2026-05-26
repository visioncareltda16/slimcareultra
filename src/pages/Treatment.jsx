import { useState, useEffect } from 'react';
import { Check, ActivitySquare, Syringe as SyringeIcon, Loader2, Info } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from 'chart.js';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip
);

export function Treatment({ currentUser }) {
  const [protocolo, setProtocolo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventos, setEventos] = useState([]);
  const [savingDose, setSavingDose] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      // Fetch Protocol
      const docSnap = await getDoc(doc(db, 'protocolos_tratamento', currentUser.uid));
      if (docSnap.exists()) {
        setProtocolo(docSnap.data());
      }

      // Fetch Calendar Events to find applications
      const evtQ = query(collection(db, 'calendario_eventos'), where('pacienteId', '==', currentUser.uid));
      const evtSnap = await getDocs(evtQ);
      
      const evtList = [];
      evtSnap.forEach(e => {
        const d = e.data();
        if (d.aplicacoes && d.aplicacoes.length > 0) {
          evtList.push(d);
        }
      });
      // Sort by date descending
      evtList.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setEventos(evtList);

    } catch (error) {
      console.error("Erro ao buscar dados do tratamento:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrarAplicacao = async () => {
    if (!protocolo) return alert("Nenhum protocolo ativo!");
    setSavingDose(true);
    
    try {
      const today = new Date();
      // YYYY-MM-DD local timezone adjusted
      const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const eventId = `${currentUser.uid}_${todayStr}`;
      
      const docRef = doc(db, 'calendario_eventos', eventId);
      const snap = await getDoc(docRef);
      
      let dayData = {
        pacienteId: currentUser.uid,
        data: todayStr,
        aplicacoes: [],
        sintomas: [],
        notas: '',
        exames: [],
        updatedAt: new Date().toISOString()
      };

      if (snap.exists()) {
        dayData = snap.data();
      }

      // Add application if not already added today
      const alreadyAdded = dayData.aplicacoes.find(a => a.medicamento === protocolo.medicamento);
      if (!alreadyAdded) {
        dayData.aplicacoes.push({
          medicamento: protocolo.medicamento,
          dose: protocolo.dose,
          horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });
      }

      await setDoc(docRef, dayData);
      
      // Refresh Data
      await fetchData();

    } catch (error) {
      console.error("Erro ao registrar dose:", error);
      alert("Erro ao registrar a dose.");
    } finally {
      setSavingDose(false);
    }
  };

  // Cálculos de Próxima Dose
  let diasRestantes = '?';
  let percGasto = 0;
  let hasHistory = eventos.length > 0;
  let daysSinceLast = 0;

  if (protocolo && hasHistory) {
    const lastDate = new Date(eventos[0].data + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = Math.abs(today - lastDate);
    daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Parse periodicidade (e.g. "7 dias")
    const match = protocolo.periodicidade.match(/\d+/);
    const intervalDays = match ? parseInt(match[0]) : 7;
    
    let remaining = intervalDays - daysSinceLast;
    if (remaining < 0) remaining = 0;
    
    diasRestantes = remaining;
    
    // 0 = Círculo cheio (acabou de tomar), intervalDays = Círculo vazio (hora de tomar)
    percGasto = (daysSinceLast / intervalDays);
    if (percGasto > 1) percGasto = 1;
  } else if (protocolo) {
    // Has protocol but no history
    diasRestantes = 'Hoje';
  }

  // Dash array = 283 for full circle. 283 * percGasto is how much is missing.
  // We want full circle when remaining is large.
  const circleOffset = percGasto * 283;

  // Curva Farmacocinética Ilustrativa (Decaimento)
  // GLP-1 meia vida ~5 dias.
  const mockPharmaData = [];
  for (let i = 6; i >= 0; i--) {
    const val = 10 * Math.pow(0.5, (daysSinceLast + i) / 5);
    mockPharmaData.push(parseFloat(val.toFixed(1)));
  }

  const pharmaData = {
    labels: ['-6d', '-5d', '-4d', '-3d', '-2d', '-1d', 'Hoje'],
    datasets: [{
      label: 'Nível Sanguíneo (Estimado)',
      data: hasHistory ? mockPharmaData : [0,0,0,0,0,0,0],
      backgroundColor: function(context) {
        return context.dataIndex === 6 ? '#D4AF37' : 'rgba(50, 173, 230, 0.6)';
      },
      borderRadius: 6,
      borderSkipped: false
    }]
  };

  const pharmaOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: '#8E8E93', font: { family: 'Open Sans', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
        ticks: { display: false }
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-blue" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-[fadeIn_0.4s_ease-out]">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Next Dose Gauge */}
        <div className="glass-card p-8 flex flex-col items-center text-center col-span-1">
          <h3 className="text-sm font-medium text-brand-gray uppercase tracking-widest mb-6">Próxima Aplicação</h3>
          
          <div className="relative w-48 h-48 mb-6">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="none"/>
              <circle 
                cx="50" cy="50" r="45" 
                stroke={diasRestantes === 0 || diasRestantes === 'Hoje' ? '#30D158' : '#32ADE6'} 
                strokeWidth="6" strokeLinecap="round" fill="none" 
                className="metric-circle" 
                style={{ 
                  strokeDashoffset: isNaN(circleOffset) ? 0 : circleOffset, 
                  filter: diasRestantes === 0 || diasRestantes === 'Hoje' ? 'drop-shadow(0 0 6px rgba(48, 209, 88, 0.6))' : 'drop-shadow(0 0 6px rgba(50, 173, 230, 0.4))' 
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-semibold ${diasRestantes === 0 || diasRestantes === 'Hoje' ? 'text-brand-turquoise' : 'text-white'}`}>
                {diasRestantes}
              </span>
              <span className="text-xs text-brand-gray uppercase tracking-wider mt-1">Dias</span>
            </div>
          </div>
          
          {protocolo ? (
            <>
              <p className="text-lg font-medium mb-1">Dose de {protocolo.dose}</p>
              <p className="text-sm text-brand-gray mb-2">{protocolo.medicamento}</p>
              <p className="text-xs font-semibold text-brand-turquoise bg-brand-turquoise/10 px-3 py-1 rounded-full mb-6">
                Periodicidade: {protocolo.periodicidade}
              </p>
            </>
          ) : (
            <p className="text-sm text-brand-gray mb-6">Nenhum protocolo ativo definido pelo seu médico.</p>
          )}
          
          <button 
            onClick={handleRegistrarAplicacao}
            disabled={savingDose || !protocolo}
            className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {savingDose ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} 
            {savingDose ? 'Salvando...' : 'Registrar Aplicação'}
          </button>
        </div>

        {/* Pharmacokinetics & History */}
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">Farmacocinética Simbólica</h3>
                <p className="text-xs text-brand-gray">Decaimento estimado desde a última dose.</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                <ActivitySquare className="w-5 h-5" />
              </div>
            </div>
            <div className="w-full h-48 mt-auto">
              <Bar data={pharmaData} options={pharmaOptions} />
            </div>
          </div>
          
          <div className="glass-card p-6 flex flex-col">
            <h3 className="text-base font-semibold mb-4">Histórico de Aplicações</h3>
            
            {!hasHistory ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                 <Info className="w-8 h-8 text-brand-gray mb-2" />
                 <p className="text-sm text-brand-gray text-center max-w-sm">
                    Nenhuma dose registrada ainda.<br/>
                    Utilize o botão ao lado ou o Calendário para registrar.
                 </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-2">
                {eventos.map((evt) => (
                  <div key={evt.data} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-brand-turquoise/20 text-brand-turquoise border border-brand-turquoise/30 flex items-center justify-center">
                      <Check className="w-5 h-5" />
                    </div>
                    <div className="flex-1 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">{evt.aplicacoes[0].dose} - {evt.aplicacoes[0].medicamento}</p>
                        <p className="text-xs text-brand-gray">{new Date(evt.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 bg-white/10 rounded-md">
                        {evt.aplicacoes[0].horario || 'Registrado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
