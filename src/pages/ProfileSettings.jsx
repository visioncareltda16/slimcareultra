import { useState, useEffect } from 'react';
import { User, Mail, Save, Loader2, ShieldAlert, Camera, Key } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';

export function ProfileSettings({ currentUser, userRole }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({});
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser?.uid) return;
      try {
        let collectionName = userRole === 'medico' ? 'medicos_cadastros' : 'pacientes_cadastros';
        if (userRole === 'admin') collectionName = 'users'; // Admin might just have basic user data
        
        const docRef = doc(db, collectionName, currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setFormData(docSnap.data());
        } else {
          // Fallback if specific collection doc is missing
          setFormData({ nome: currentUser.name || currentUser.nome || '' });
        }

        // Fetch doctors if user is patient
        if (userRole === 'paciente') {
          const q = query(collection(db, 'users'), where('role', '==', 'medico'), where('status', '==', 'approved'));
          const snapshot = await getDocs(q);
          const docsList = [];
          for (const d of snapshot.docs) {
            const mDoc = await getDoc(doc(db, 'medicos_cadastros', d.id));
            if (mDoc.exists()) {
              docsList.push({ uid: d.id, ...mDoc.data() });
            }
          }
          docsList.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
          setDoctors(docsList);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        setErrorMsg('Erro ao carregar dados do perfil.');
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [currentUser, userRole]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleResetPassword = async () => {
    if (!currentUser?.email) return;
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      setSuccessMsg('Um e-mail de redefinição de senha foi enviado para você.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (error) {
      console.error(error);
      setErrorMsg('Erro ao enviar e-mail de redefinição de senha.');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Compress image to Base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, avatarBase64: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      // Clean undefined values from formData to prevent Firestore errors
      const cleanData = Object.entries(formData).reduce((acc, [k, v]) => {
        if (v !== undefined) acc[k] = v;
        return acc;
      }, {});

      // Update specific collection
      if (userRole === 'medico' || userRole === 'paciente') {
        const collectionName = userRole === 'medico' ? 'medicos_cadastros' : 'pacientes_cadastros';
        await setDoc(doc(db, collectionName, currentUser.uid), cleanData, { merge: true });
      }
      
      // Update base users collection name if it changed
      if (cleanData.nome) {
        await setDoc(doc(db, 'users', currentUser.uid), { name: cleanData.nome }, { merge: true });
      }

      setSuccessMsg('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error("Error updating profile:", error);
      setErrorMsg('Erro ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-brand-gray" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto animate-[fadeIn_0.4s_ease-out]">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-brand font-light">Configurações de <span className="font-bold">Perfil</span></h2>
        <p className="text-sm text-brand-gray">Mantenha seus dados atualizados para garantir o melhor acompanhamento.</p>
      </div>

      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8 pb-8 border-b border-white/5 relative">
          
          <div className="relative group cursor-pointer">
            <div className="w-24 h-24 rounded-full bg-brand-black border border-white/10 flex items-center justify-center text-3xl font-bold text-brand-gray uppercase overflow-hidden shadow-xl">
              {formData.avatarBase64 ? (
                <img src={formData.avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (formData.nome || currentUser?.name || 'U').charAt(0)
              )}
            </div>
            <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          </div>

          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold">{formData.nome || currentUser?.name}</h3>
            <p className="text-sm text-brand-gray flex items-center justify-center md:justify-start gap-1 mt-1"><Mail className="w-3.5 h-3.5"/> {currentUser?.email}</p>
            <span className={`inline-block mt-3 px-3 py-1 rounded-md text-xs uppercase font-bold tracking-wide ${userRole === 'medico' ? 'bg-brand-turquoise/20 text-brand-turquoise' : userRole === 'admin' ? 'bg-brand-gold/20 text-brand-gold' : 'bg-brand-blue/20 text-brand-blue'}`}>
              {userRole === 'medico' ? 'Médico' : userRole === 'admin' ? 'Administrador' : 'Paciente'}
            </span>
          </div>

          <div className="md:absolute right-0 top-0">
            <button type="button" onClick={handleResetPassword} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
              <Key className="w-4 h-4" /> Alterar Senha
            </button>
          </div>
        </div>

        {userRole === 'admin' && (
          <div className="p-4 bg-brand-gold/10 border border-brand-gold/20 rounded-xl mb-6 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" />
            <p className="text-sm text-brand-gold/90">Sua conta tem privilégios de Administrador. Os dados principais de acesso são gerenciados pela configuração da plataforma.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {successMsg && <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm">{successMsg}</div>}
          {errorMsg && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">{errorMsg}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Nome Completo</label>
              <input name="nome" value={formData.nome || ''} onChange={handleChange} required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-blue transition-colors" />
            </div>

            {userRole === 'paciente' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">CPF</label>
                  <input name="cpf" value={formData.cpf || ''} onChange={handleChange} required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-blue transition-colors" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Data de Nascimento</label>
                  <input name="nascimento" value={formData.nascimento || ''} onChange={handleChange} required type="date" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-blue transition-colors" />
                </div>
              </>
            )}

            {userRole === 'medico' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">CRM</label>
                  <input name="crm" value={formData.crm || ''} onChange={handleChange} required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-blue transition-colors" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">UF CRM</label>
                  <select name="uf" value={formData.uf || ''} onChange={handleChange} required className="w-full bg-[#1c1c1e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-blue transition-colors">
                    <option value="">Selecione</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {userRole === 'paciente' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Endereço Completo</label>
                <input name="endereco" value={formData.endereco || ''} onChange={handleChange} required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-blue transition-colors" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Cidade</label>
                  <input name="cidade" value={formData.cidade || ''} onChange={handleChange} required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-blue transition-colors" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Estado</label>
                  <select name="estado" value={formData.estado || ''} onChange={handleChange} required className="w-full bg-[#1c1c1e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-blue transition-colors">
                    <option value="">Selecione</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Médico Responsável</label>
                <select name="medico" value={formData.medico || ''} onChange={handleChange} required className="w-full bg-[#1c1c1e] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-brand-blue transition-colors">
                  <option value="">Selecione...</option>
                  <option value="nao_sei">Ainda não possuo / Não sei</option>
                  {doctors.map(doc => (
                    <option key={doc.uid} value={doc.uid}>{doc.nome}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="pt-6 border-t border-white/5 mt-2 flex justify-end">
            <button 
              type="submit" 
              disabled={saving || userRole === 'admin'} 
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-blue hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
