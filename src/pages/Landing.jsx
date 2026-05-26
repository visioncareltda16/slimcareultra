import { useState, useEffect } from 'react';
import { UserRound, Stethoscope, Lock, ArrowLeft, Clock, Mail, Key } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

export function Landing({ onLogin }) {
  const [view, setView] = useState('home'); // 'home' | 'register_patient' | 'register_doctor' | 'login' | 'pending'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [dbSpecialties, setDbSpecialties] = useState([]);
  const [dbDoctors, setDbDoctors] = useState([]);

  useEffect(() => {
    const fetchDynamicData = async () => {
      try {
        // Fetch specialties
        const specDoc = await getDoc(doc(db, 'config', 'specialties'));
        if (specDoc.exists()) {
          setDbSpecialties((specDoc.data().list || []).sort((a, b) => a.localeCompare(b)));
        } else {
          setDbSpecialties(['Endocrinologia', 'Nutrologia', 'Clínica Médica'].sort((a, b) => a.localeCompare(b)));
        }

        // Fetch approved doctors
        const docsQuery = query(collection(db, 'users'), where('role', '==', 'medico'), where('status', '==', 'approved'));
        const docsSnapshot = await getDocs(docsQuery);
        let doctorsList = [];
        for (const d of docsSnapshot.docs) {
          const medData = await getDoc(doc(db, 'medicos_cadastros', d.id));
          if (medData.exists()) {
            doctorsList.push({ uid: d.id, nome: medData.data().nome });
          } else {
            doctorsList.push({ uid: d.id, nome: d.data().name });
          }
        }
        doctorsList.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setDbDoctors(doctorsList);
      } catch (error) {
        console.error("Error fetching dynamic data:", error);
      }
    };
    fetchDynamicData();
  }, []);

  const handlePatientSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const name = formData.get('name');
    
    try {
      // 1. Create Auth Account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 2. Save Roles & Status and Details atomically using writeBatch
      const batch = writeBatch(db);
      
      batch.set(doc(db, 'users', user.uid), {
        email: email,
        name: name,
        role: 'paciente',
        status: 'pending', // Requires admin approval
        createdAt: new Date().toISOString()
      });

      batch.set(doc(db, 'pacientes_cadastros', user.uid), {
        nome: name,
        nascimento: formData.get('nascimento'),
        cpf: formData.get('cpf'),
        endereco: formData.get('endereco'),
        cidade: formData.get('cidade'),
        estado: formData.get('estado'),
        medico: formData.get('medico'),
      });

      await batch.commit();
      await signOut(auth);
      setView('pending');
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const name = formData.get('name');
    const crm = formData.get('crm');
    const uf = formData.get('uf');

    if (selectedSpecialties.length === 0) {
      setErrorMsg('Selecione pelo menos uma especialidade.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const batch = writeBatch(db);

      batch.set(doc(db, 'users', user.uid), {
        email: email,
        name: name,
        role: 'medico',
        status: 'pending', // Requires admin approval
        createdAt: new Date().toISOString()
      });

      batch.set(doc(db, 'medicos_cadastros', user.uid), {
        nome: name,
        crm: crm,
        uf: uf,
        especialidades: selectedSpecialties
      });

      await batch.commit();
      await signOut(auth);
      setView('pending');
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.status === 'pending') {
          await signOut(auth);
          setErrorMsg('Sua conta ainda está em análise pelo Administrador. Aguarde a aprovação.');
          setLoading(false);
          return;
        } else if (userData.status === 'rejected') {
          await signOut(auth);
          setErrorMsg('Sua solicitação de conta foi recusada pelo Administrador.');
          setLoading(false);
          return;
        }
        // If approved, App.jsx handles the redirect.
        // Fallback: if App.jsx fails to redirect within 3 seconds, clear loading to prevent hanging UI
        setTimeout(() => setLoading(false), 3000);
      } else {
        // Auto-recovery: if the Auth user exists but the DB document doesn't, it's a broken registration.
        // We delete the Auth user so they can register again.
        try {
          await userCredential.user.delete();
        } catch (e) {
          console.error("Failed to delete broken user:", e);
        }
        await signOut(auth);
        setErrorMsg('Houve uma falha no seu cadastro anterior. Limpamos o sistema, por favor faça seu credenciamento novamente.');
        setLoading(false);
        return;
      }
      // If approved, App.jsx handles the redirect.
    } catch (error) {
      setErrorMsg('E-mail ou senha inválidos.');
      setLoading(false);
    }
  };

  const renderHome = () => (
    <div className="flex flex-col items-center w-full max-w-4xl px-6 animate-[fadeIn_0.4s_ease-out]">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-16">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#111] to-[#222] border border-white/10 shadow-2xl flex items-center justify-center text-3xl font-brand font-bold glow-blue mb-8">
          S
        </div>
        <h1 className="text-5xl md:text-7xl font-brand font-light tracking-tight mb-2">
          SlimCare <span className="font-bold text-gradient-gold">Ultra</span>
        </h1>
        <p className="text-sm md:text-base text-brand-gray tracking-[0.3em] uppercase font-semibold">
          Inteligência Clínica
        </p>
      </div>

      {/* Portal Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Paciente Card */}
        <button 
          onClick={() => setView('register_patient')}
          className="group relative flex flex-col items-center text-center p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-brand-blue/10 hover:border-brand-blue/30 backdrop-blur-xl transition-all duration-300 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-brand-blue/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="w-16 h-16 rounded-full bg-brand-black border border-white/10 flex items-center justify-center mb-6 text-brand-blue group-hover:scale-110 transition-transform duration-300 shadow-lg">
            <UserRound className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold mb-2">Área do Paciente</h3>
          <p className="text-sm text-brand-gray">Acompanhe sua jornada clínica, exames e metas metabólicas.</p>
        </button>

        {/* Medico Card */}
        <button 
          onClick={() => setView('register_doctor')}
          className="group relative flex flex-col items-center text-center p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-brand-turquoise/10 hover:border-brand-turquoise/30 backdrop-blur-xl transition-all duration-300 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-brand-turquoise/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="w-16 h-16 rounded-full bg-brand-black border border-white/10 flex items-center justify-center mb-6 text-brand-turquoise group-hover:scale-110 transition-transform duration-300 shadow-lg">
            <Stethoscope className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold mb-2">Portal Médico</h3>
          <p className="text-sm text-brand-gray">Cadastro e gestão de pacientes, protocolos e aprovações de tratamento.</p>
        </button>
      </div>

      <div className="mt-16 flex flex-col items-center gap-4 text-brand-gray opacity-80">
        <button 
          onClick={() => setView('login')}
          className="px-6 py-2 rounded-full border border-white/20 text-sm font-semibold hover:bg-white hover:text-black transition-all"
        >
          Já tenho uma conta (Entrar)
        </button>

        <div className="flex items-center gap-2 mt-4 opacity-60">
          <Lock className="w-3.5 h-3.5" />
          <p className="text-xs uppercase tracking-wider font-semibold">
            Acessos gerenciados e liberados por <button onClick={() => setView('login')} className="hover:text-white hover:underline cursor-pointer">Admin</button>
          </p>
        </div>
      </div>
    </div>
  );

  const renderRegisterPatient = () => (
    <div className="flex flex-col items-center w-full max-w-2xl px-6 animate-[fadeIn_0.4s_ease-out]">
      <button 
        onClick={() => setView('home')}
        className="self-start flex items-center gap-2 text-brand-gray hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">Voltar</span>
      </button>

      <div className="w-full glass-card p-8 md:p-10 border-brand-blue/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/10 blur-[80px] rounded-full z-0"></div>
        
        <h2 className="text-2xl font-brand font-bold mb-2 relative z-10">Cadastro de Paciente</h2>
        <p className="text-sm text-brand-gray mb-8 relative z-10">Preencha seus dados reais. Seu acesso será liberado pela equipe clínica após a verificação.</p>

        <form onSubmit={handlePatientSubmit} className="flex flex-col gap-3 relative z-10">
          
          {errorMsg && <div className="p-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg text-sm mb-1">{errorMsg}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">E-mail</label>
              <input name="email" required type="email" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all" placeholder="seu@email.com" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Criar Senha</label>
              <input name="password" required minLength="6" type="password" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all" placeholder="Mínimo 6 caracteres" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Nome Completo</label>
            <input name="name" required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all" placeholder="Ex: João da Silva" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Data de Nascimento</label>
              <input name="nascimento" required type="date" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">CPF</label>
              <input name="cpf" required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all" placeholder="000.000.000-00" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Endereço Completo</label>
            <input name="endereco" required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all" placeholder="Rua, Número, Bairro, Complemento" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Cidade</label>
              <input name="cidade" required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all" placeholder="Sua cidade" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Estado</label>
              <select name="estado" required className="w-full bg-[#1c1c1e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all">
                <option value="">Selecione...</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Médico Responsável</label>
            <select name="medico" required className="w-full bg-[#1c1c1e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all">
              <option value="">Selecione...</option>
              <option value="nao_sei">Ainda não possuo / Não sei</option>
              {dbDoctors.map(doc => (
                <option key={doc.uid} value={doc.uid}>{doc.nome}</option>
              ))}
            </select>
          </div>

          <button disabled={loading} type="submit" className="mt-3 w-full py-3.5 rounded-lg bg-gradient-to-r from-brand-blue to-indigo-600 text-white font-bold tracking-wide shadow-lg glow-blue hover:scale-[1.02] transition-all disabled:opacity-50">
            {loading ? 'Processando...' : 'Solicitar Acesso Seguro'}
          </button>
        </form>
      </div>
    </div>
  );

  const [selectedSpecialties, setSelectedSpecialties] = useState([]);
  const toggleSpecialty = (spec) => {
    if (selectedSpecialties.includes(spec)) {
      setSelectedSpecialties(selectedSpecialties.filter(s => s !== spec));
    } else {
      if (selectedSpecialties.length < 3) {
        setSelectedSpecialties([...selectedSpecialties, spec]);
      }
    }
  };

  const renderRegisterDoctor = () => (
    <div className="flex flex-col items-center w-full max-w-2xl px-6 animate-[fadeIn_0.4s_ease-out]">
      <button 
        onClick={() => setView('home')}
        className="self-start flex items-center gap-2 text-brand-gray hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">Voltar</span>
      </button>

      <div className="w-full glass-card p-8 md:p-10 border-brand-turquoise/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-turquoise/10 blur-[80px] rounded-full z-0"></div>
        
        <h2 className="text-2xl font-brand font-bold mb-2 relative z-10">Credenciamento Médico</h2>
        <p className="text-sm text-brand-gray mb-8 relative z-10">Faça parte da nossa rede de excelência metabólica.</p>

        <form onSubmit={handleDoctorSubmit} className="flex flex-col gap-3 relative z-10">
          
          {errorMsg && <div className="p-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg text-sm mb-1">{errorMsg}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">E-mail</label>
              <input name="email" required type="email" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-turquoise/50 focus:border-brand-turquoise transition-all" placeholder="seu@email.com" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Criar Senha</label>
              <input name="password" required minLength="6" type="password" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-turquoise/50 focus:border-brand-turquoise transition-all" placeholder="Mínimo 6 caracteres" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Nome e Sobrenome</label>
            <input name="name" required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-turquoise/50 focus:border-brand-turquoise transition-all" placeholder="Ex: Dr. Carlos Silva" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-1 md:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">CRM</label>
              <input name="crm" required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand-turquoise/50 focus:border-brand-turquoise transition-all" placeholder="Apenas números" />
            </div>
            <div className="col-span-1 flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">UF CRM</label>
              <select name="uf" required className="w-full bg-[#1c1c1e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-turquoise/50 focus:border-brand-turquoise transition-all">
                <option value="">Selecione</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1 mt-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Especialidades (Até 3)</label>
              <span className="text-[10px] text-brand-gray">{selectedSpecialties.length}/3 Selecionadas</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {dbSpecialties.map(spec => {
                const isSelected = selectedSpecialties.includes(spec);
                const isDisabled = !isSelected && selectedSpecialties.length >= 3;
                return (
                  <label key={spec} className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${isSelected ? 'bg-brand-turquoise/20 border-brand-turquoise text-brand-turquoise' : 'bg-white/5 border-white/10 text-brand-gray hover:bg-white/10'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => toggleSpecialty(spec)}
                    />
                    {spec}
                  </label>
                );
              })}
            </div>
          </div>

          <button disabled={loading} type="submit" className="mt-3 w-full py-3 rounded-lg bg-gradient-to-r from-brand-turquoise to-emerald-600 text-white font-bold tracking-wide shadow-[0_0_20px_rgba(48,209,88,0.2)] hover:scale-[1.02] transition-all disabled:opacity-50">
            {loading ? 'Processando...' : 'Solicitar Credenciamento'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="flex flex-col items-center w-full max-w-md px-6 animate-[fadeIn_0.4s_ease-out]">
      <button 
        onClick={() => setView('home')}
        className="self-start flex items-center gap-2 text-brand-gray hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">Voltar</span>
      </button>

      <div className="w-full glass-card p-8 md:p-10 border-white/20 relative overflow-hidden">
        <h2 className="text-2xl font-brand font-bold mb-2 relative z-10">Acesso ao Sistema</h2>
        <p className="text-sm text-brand-gray mb-8 relative z-10">Entre com seu e-mail e senha.</p>

        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5 relative z-10">
          {errorMsg && <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl text-sm mb-2">{errorMsg}</div>}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">E-mail</label>
            <input name="email" required type="email" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Senha</label>
            <input name="password" required type="password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all" />
          </div>

          <button disabled={loading} type="submit" className="mt-4 w-full py-4 rounded-xl bg-white text-black font-bold tracking-wide hover:bg-gray-200 transition-all disabled:opacity-50">
            {loading ? 'Acessando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderPending = () => (
    <div className="flex flex-col items-center text-center w-full max-w-lg px-6 animate-[fadeIn_0.5s_ease-out]">
      <div className="w-24 h-24 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-brand-gold mb-8 glow-gold">
        <Clock className="w-10 h-10 animate-pulse" />
      </div>
      
      <h2 className="text-3xl font-brand font-bold mb-4">Cadastro em Análise</h2>
      <p className="text-brand-gray mb-10 leading-relaxed">
        Seus dados foram enviados com sucesso, sob rigoroso sigilo médico.<br/><br/>
        A administração da <strong>SlimCare Ultra</strong> irá validar as informações e liberar o seu acesso ao painel metabólico em breve.
      </p>

      <button 
        onClick={() => setView('home')}
        className="px-8 py-3 rounded-xl border border-white/20 text-sm font-semibold hover:bg-white hover:text-black transition-all"
      >
        Voltar à Tela Inicial
      </button>
    </div>
  );

  return (
    <div className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-x-hidden overflow-y-auto py-12 md:py-0">
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-brand-black z-0"></div>
      <div className="fixed top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-brand-blue/10 blur-[120px] z-0 pointer-events-none"></div>
      <div className="fixed bottom-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-brand-gold/5 blur-[120px] z-0 pointer-events-none"></div>

      {/* Dynamic Content */}
      <div className="relative z-10 w-full flex justify-center">
        {view === 'home' && renderHome()}
        {view === 'login' && renderLogin()}
        {view === 'register_patient' && renderRegisterPatient()}
        {view === 'register_doctor' && renderRegisterDoctor()}
        {view === 'pending' && renderPending()}
      </div>
    </div>
  );
}
