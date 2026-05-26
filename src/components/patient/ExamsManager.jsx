import { useState, useEffect } from 'react';
import { FileText, Upload, Loader2, ExternalLink } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export function ExamsManager({ currentUser }) {
  const [exames, setExames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchExames();
  }, [currentUser]);

  const fetchExames = async () => {
    if (!currentUser?.uid) return;
    try {
      const q = query(
        collection(db, 'pacientes_exames'),
        where('pacienteId', '==', currentUser.uid)
      );
      const snap = await getDocs(q);
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setExames(data);
    } catch (error) {
      console.error("Erro ao buscar exames:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser?.uid) return;

    if (file.type !== 'application/pdf') {
      alert("Por favor, selecione um arquivo PDF.");
      return;
    }

    setUploading(true);
    try {
      const fileRef = ref(storage, `pacientes/${currentUser.uid}/exames/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const novoExame = {
        pacienteId: currentUser.uid,
        nomeArquivo: file.name,
        url: url,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'pacientes_exames'), novoExame);

      setExames(prev => [{ id: Date.now().toString(), ...novoExame }, ...prev]);
    } catch (error) {
      console.error("Erro no upload do exame:", error);
      alert("Houve um erro no envio do PDF.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-card p-6 flex flex-col h-full animate-[fadeIn_0.6s_ease-out]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-turquoise" />
          Central de Exames
        </h3>
        
        <div className="relative">
          <input 
            type="file" 
            accept="application/pdf" 
            className="hidden" 
            id="exame-upload"
            onChange={handleUpload}
            disabled={uploading}
          />
          <label 
            htmlFor="exame-upload"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium cursor-pointer transition-colors"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-brand-turquoise" /> : <Upload className="w-4 h-4 text-brand-turquoise" />}
            {uploading ? 'Enviando PDF...' : 'Anexar Exame'}
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-gray" />
        </div>
      ) : exames.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center opacity-50">
          <FileText className="w-12 h-12 mb-3 text-brand-gray" />
          <p className="text-sm">Nenhum exame anexado.</p>
          <p className="text-xs text-brand-gray mt-1">Envie exames de sangue ou laudos em formato PDF.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2">
          {exames.map(exame => (
            <div key={exame.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-turquoise/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-brand-turquoise" />
                </div>
                <div>
                  <p className="text-sm font-medium line-clamp-1">{exame.nomeArquivo}</p>
                  <p className="text-xs text-brand-gray">{new Date(exame.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <a 
                href={exame.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-black/30 hover:bg-black/50 text-brand-gray hover:text-white transition-all opacity-0 group-hover:opacity-100"
                title="Visualizar PDF"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
