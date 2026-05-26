import { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, Settings, ShieldAlert, Loader2, Stethoscope, Plus, Trash2, ArrowUpRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('solicitacoes'); // solicitacoes, pacientes, medicos, especialidades
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedPatients, setApprovedPatients] = useState([]);
  const [approvedDoctors, setApprovedDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'solicitacoes') {
        const q = query(collection(db, 'users'), where('status', '==', 'pending'));
        const querySnapshot = await getDocs(q);
        const requests = await populateSpecificData(querySnapshot.docs);
        requests.sort((a, b) => (a.nome || a.name || '').localeCompare(b.nome || b.name || ''));
        setPendingRequests(requests);
      } else if (activeTab === 'pacientes') {
        const q = query(collection(db, 'users'), where('status', '==', 'approved'), where('role', '==', 'paciente'));
        const querySnapshot = await getDocs(q);
        const patients = await populateSpecificData(querySnapshot.docs);
        patients.sort((a, b) => (a.nome || a.name || '').localeCompare(b.nome || b.name || ''));
        setApprovedPatients(patients);
      } else if (activeTab === 'medicos') {
        const q = query(collection(db, 'users'), where('status', '==', 'approved'), where('role', '==', 'medico'));
        const querySnapshot = await getDocs(q);
        const doctors = await populateSpecificData(querySnapshot.docs);
        doctors.sort((a, b) => (a.nome || a.name || '').localeCompare(b.nome || b.name || ''));
        setApprovedDoctors(doctors);
      } else if (activeTab === 'especialidades') {
        const docRef = doc(db, 'config', 'specialties');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const list = docSnap.data().list || [];
          list.sort((a, b) => a.localeCompare(b));
          setSpecialties(list);
        } else {
          const list = ['Endocrinologia', 'Nutrologia', 'Clínica Médica'].sort((a, b) => a.localeCompare(b));
          await setDoc(docRef, { list });
          setSpecialties(list);
        }
      }
    } catch (error) {
      console.error("Error fetching data: ", error);
    } finally {
      setLoading(false);
    }
  };

  const populateSpecificData = async (docs) => {
    const results = [];
    for (const docSnapshot of docs) {
      const userData = docSnapshot.data();
      let specificData = {};
      if (userData.role === 'paciente') {
        const pDoc = await getDoc(doc(db, 'pacientes_cadastros', docSnapshot.id));
        if (pDoc.exists()) specificData = pDoc.data();
      } else if (userData.role === 'medico') {
        const mDoc = await getDoc(doc(db, 'medicos_cadastros', docSnapshot.id));
        if (mDoc.exists()) specificData = mDoc.data();
      }
      results.push({ uid: docSnapshot.id, ...userData, ...specificData });
    }
    return results;
  };

  const handleApprove = async (uid) => {
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'approved' });
      setPendingRequests(prev => prev.filter(req => req.uid !== uid));
    } catch (error) {
      console.error("Error approving user: ", error);
    }
  };

  const handleReject = async (uid) => {
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'rejected' });
      setPendingRequests(prev => prev.filter(req => req.uid !== uid));
    } catch (error) {
      console.error("Error rejecting user: ", error);
    }
  };

  const handleToggleAdmin = async (uid, currentIsAdmin) => {
    const action = currentIsAdmin ? 'remover os privilégios de' : 'conceder privilégios de';
    if(!window.confirm(`Tem certeza que deseja ${action} Administrador para este médico? Ele continuará com o Portal Médico ativo.`)) return;
    try {
      await updateDoc(doc(db, 'users', uid), { isAdmin: !currentIsAdmin });
      setApprovedDoctors(prev => prev.map(d => d.uid === uid ? { ...d, isAdmin: !currentIsAdmin } : d));
    } catch (error) {
      console.error("Error updating admin status: ", error);
    }
  };

  const handleSuspend = async (uid, role) => {
    if(!window.confirm("Tem certeza que deseja inativar este usuário? Ele perderá acesso ao sistema.")) return;
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'rejected' });
      if (role === 'medico') setApprovedDoctors(prev => prev.filter(req => req.uid !== uid));
      if (role === 'paciente') setApprovedPatients(prev => prev.filter(req => req.uid !== uid));
    } catch (error) {
      console.error("Error suspending user: ", error);
    }
  };

  const handleDelete = async (uid, role) => {
    if(!window.confirm("ATENÇÃO: Deseja EXCLUIR este usuário permanentemente? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      if (role === 'medico') {
        await deleteDoc(doc(db, 'medicos_cadastros', uid));
        setApprovedDoctors(prev => prev.filter(req => req.uid !== uid));
      } else if (role === 'paciente') {
        await deleteDoc(doc(db, 'pacientes_cadastros', uid));
        setApprovedPatients(prev => prev.filter(req => req.uid !== uid));
      }
    } catch (error) {
      console.error("Error deleting user: ", error);
    }
  };

  const handleAddSpecialty = async (e) => {
    e.preventDefault();
    if (!newSpecialty.trim()) return;
    try {
      const updatedList = [...specialties, newSpecialty.trim()].sort((a, b) => a.localeCompare(b));
      await setDoc(doc(db, 'config', 'specialties'), { list: updatedList });
      setSpecialties(updatedList);
      setNewSpecialty('');
    } catch (error) {
      console.error("Error adding specialty: ", error);
    }
  };

  const handleRemoveSpecialty = async (specToRemove) => {
    try {
      const updatedList = specialties.filter(s => s !== specToRemove);
      await setDoc(doc(db, 'config', 'specialties'), { list: updatedList });
      setSpecialties(updatedList);
    } catch (error) {
      console.error("Error removing specialty: ", error);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease-out]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => setActiveTab('solicitacoes')} className={`glass-card p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-all ${activeTab === 'solicitacoes' ? 'border-brand-gold bg-brand-gold/5' : ''}`}>
          <ShieldAlert className={`w-5 h-5 ${activeTab === 'solicitacoes' ? 'text-brand-gold' : 'text-brand-gray'}`} />
          <span className="text-xs font-semibold uppercase tracking-wider">Aprovações</span>
        </button>
        <button onClick={() => setActiveTab('pacientes')} className={`glass-card p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-all ${activeTab === 'pacientes' ? 'border-brand-blue bg-brand-blue/5' : ''}`}>
          <Users className={`w-5 h-5 ${activeTab === 'pacientes' ? 'text-brand-blue' : 'text-brand-gray'}`} />
          <span className="text-xs font-semibold uppercase tracking-wider">Pacientes</span>
        </button>
        <button onClick={() => setActiveTab('medicos')} className={`glass-card p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-all ${activeTab === 'medicos' ? 'border-brand-turquoise bg-brand-turquoise/5' : ''}`}>
          <Stethoscope className={`w-5 h-5 ${activeTab === 'medicos' ? 'text-brand-turquoise' : 'text-brand-gray'}`} />
          <span className="text-xs font-semibold uppercase tracking-wider">Médicos</span>
        </button>
        <button onClick={() => setActiveTab('especialidades')} className={`glass-card p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-all ${activeTab === 'especialidades' ? 'border-white bg-white/5' : ''}`}>
          <Settings className={`w-5 h-5 ${activeTab === 'especialidades' ? 'text-white' : 'text-brand-gray'}`} />
          <span className="text-xs font-semibold uppercase tracking-wider">Ajustes</span>
        </button>
      </div>

      <div className="glass-card p-6 flex flex-col">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-brand-gray" /></div>
        ) : (
          <>
            {activeTab === 'solicitacoes' && (
              <>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-brand-gold" /> Solicitações Pendentes</h3>
                {pendingRequests.length === 0 ? <p className="text-brand-gray text-sm">Nenhuma solicitação no momento.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-xs text-brand-gray uppercase">
                          <th className="pb-2 font-semibold">Nome</th>
                          <th className="pb-2 font-semibold">Tipo</th>
                          <th className="pb-2 font-semibold">Doc.</th>
                          <th className="pb-2 font-semibold">E-mail</th>
                          <th className="pb-2 font-semibold text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {pendingRequests.map((req) => (
                          <tr key={req.uid} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-1 font-medium">{req.nome || req.name}</td>
                            <td className="py-1"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${req.role === 'medico' ? 'bg-brand-turquoise/20 text-brand-turquoise' : 'bg-brand-blue/20 text-brand-blue'}`}>{req.role === 'medico' ? 'Médico' : 'Paciente'}</span></td>
                            <td className="py-1 text-brand-gray">{req.cpf || req.crm || '-'}</td>
                            <td className="py-1 text-brand-gray">{req.email}</td>
                            <td className="py-1 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleApprove(req.uid)} className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20"><CheckCircle className="w-4 h-4" /></button>
                                <button onClick={() => handleReject(req.uid)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"><XCircle className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeTab === 'pacientes' && (
              <>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-brand-blue" /> Pacientes Ativos</h3>
                {approvedPatients.length === 0 ? <p className="text-brand-gray text-sm">Nenhum paciente cadastrado.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-xs text-brand-gray uppercase">
                          <th className="pb-2 font-semibold">Nome</th>
                          <th className="pb-2 font-semibold">CPF</th>
                          <th className="pb-2 font-semibold">E-mail</th>
                          <th className="pb-2 font-semibold">Médico</th>
                          <th className="pb-2 font-semibold text-right">Admin</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {approvedPatients.map((req) => (
                          <tr key={req.uid} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-1 font-medium">{req.nome || req.name}</td>
                            <td className="py-1 text-brand-gray">{req.cpf}</td>
                            <td className="py-1 text-brand-gray">{req.email}</td>
                            <td className="py-1 text-brand-gray">{req.medico_nome || req.medico || '-'}</td>
                            <td className="py-1 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handlePromoteAdmin(req.uid)} className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-[10px] uppercase font-bold flex items-center gap-1" title="Promover a Admin">
                                  <ArrowUpRight className="w-3 h-3 text-brand-gold" />
                                </button>
                                <button onClick={() => handleSuspend(req.uid, 'paciente')} className="p-1.5 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[10px] uppercase font-bold flex items-center gap-1" title="Inativar">
                                  <XCircle className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDelete(req.uid, 'paciente')} className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] uppercase font-bold flex items-center gap-1" title="Excluir">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeTab === 'medicos' && (
              <>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Stethoscope className="w-5 h-5 text-brand-turquoise" /> Médicos Ativos</h3>
                {approvedDoctors.length === 0 ? <p className="text-brand-gray text-sm">Nenhum médico cadastrado.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-xs text-brand-gray uppercase">
                          <th className="pb-2 font-semibold">Nome</th>
                          <th className="pb-2 font-semibold">CRM</th>
                          <th className="pb-2 font-semibold">E-mail</th>
                          <th className="pb-2 font-semibold">Especialidades</th>
                          <th className="pb-2 font-semibold text-right">Admin</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {approvedDoctors.map((req) => (
                          <tr key={req.uid} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-1 font-medium">{req.nome || req.name}</td>
                            <td className="py-1 text-brand-gray">{req.crm} / {req.uf}</td>
                            <td className="py-1 text-brand-gray">{req.email}</td>
                            <td className="py-1 text-brand-gray text-[10px] uppercase">{(req.especialidades || []).join(', ')}</td>
                            <td className="py-1 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleToggleAdmin(req.uid, req.isAdmin)} className={`p-1.5 rounded hover:bg-white/10 text-[10px] uppercase font-bold flex items-center gap-1 transition-colors ${req.isAdmin ? 'bg-brand-gold/10 text-brand-gold' : 'bg-white/5 text-brand-gray'}`} title={req.isAdmin ? "Remover Administrador" : "Promover a Admin"}>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleSuspend(req.uid, 'medico')} className="p-1.5 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[10px] uppercase font-bold flex items-center gap-1" title="Inativar">
                                  <XCircle className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDelete(req.uid, 'medico')} className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] uppercase font-bold flex items-center gap-1" title="Excluir">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeTab === 'especialidades' && (
              <div className="max-w-md">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-white" /> Gerenciar Especialidades</h3>
                <p className="text-sm text-brand-gray mb-6">As especialidades cadastradas aqui aparecerão como opção no formulário de cadastro dos médicos.</p>
                
                <form onSubmit={handleAddSpecialty} className="flex gap-2 mb-6">
                  <input type="text" value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)} placeholder="Nova Especialidade..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue" />
                  <button type="submit" className="bg-brand-blue hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 transition-all"><Plus className="w-4 h-4"/> Add</button>
                </form>

                <div className="flex flex-col gap-1">
                  {specialties.map(spec => (
                    <div key={spec} className="flex items-center justify-between px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                      <span className="text-xs font-medium uppercase tracking-wide text-brand-gray">{spec}</span>
                      <button onClick={() => handleRemoveSpecialty(spec)} className="text-red-400 hover:text-red-300 transition-colors p-0.5"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
