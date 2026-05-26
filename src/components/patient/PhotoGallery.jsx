import { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Loader2, Calendar } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export function PhotoGallery({ currentUser }) {
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dataFoto, setDataFoto] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchFotos();
  }, [currentUser]);

  const fetchFotos = async () => {
    if (!currentUser?.uid) return;
    try {
      const q = query(
        collection(db, 'pacientes_fotos'),
        where('pacienteId', '==', currentUser.uid)
      );
      const snap = await getDocs(q);
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.data) - new Date(a.data));
      setFotos(data);
    } catch (error) {
      console.error("Erro ao buscar fotos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser?.uid) return;

    // Apenas imagens
    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione apenas arquivos de imagem.");
      return;
    }

    setUploading(true);
    try {
      // 1. Upload to Storage
      const fileRef = ref(storage, `pacientes/${currentUser.uid}/fotos/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      // 2. Save Reference in Firestore
      const novaFoto = {
        pacienteId: currentUser.uid,
        url: url,
        data: dataFoto,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'pacientes_fotos'), novaFoto);

      // 3. Update local state
      setFotos(prev => [{ id: Date.now().toString(), ...novaFoto }, ...prev].sort((a, b) => new Date(b.data) - new Date(a.data)));
    } catch (error) {
      console.error("Erro no upload da foto:", error);
      alert("Houve um erro no envio. Verifique as configurações do Storage.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-card p-6 flex flex-col h-full animate-[fadeIn_0.5s_ease-out]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-brand-gold" />
          Evolução Fotográfica
        </h3>
        
        <div className="relative">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            id="foto-upload"
            onChange={handleUpload}
            disabled={uploading}
          />
          <label 
            htmlFor="foto-upload"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium cursor-pointer transition-colors"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-brand-gold" /> : <Camera className="w-4 h-4 text-brand-gold" />}
            {uploading ? 'Enviando...' : 'Adicionar Foto'}
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-4 h-4 text-brand-gray" />
        <span className="text-xs text-brand-gray">Data da foto:</span>
        <input 
          type="date"
          value={dataFoto}
          onChange={(e) => setDataFoto(e.target.value)}
          className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-brand-gold"
        />
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-gray" />
        </div>
      ) : fotos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center opacity-50">
          <ImageIcon className="w-12 h-12 mb-3 text-brand-gray" />
          <p className="text-sm">Nenhuma foto registrada.</p>
          <p className="text-xs text-brand-gray mt-1">Acompanhe sua transformação visual ao longo do tempo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto max-h-[400px] pr-2">
          {fotos.map(foto => (
            <div key={foto.id} className="relative group rounded-xl overflow-hidden aspect-[3/4] border border-white/10 bg-black/50">
              <img 
                src={foto.url} 
                alt="Evolução" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
                <span className="text-xs font-medium text-white">{new Date(foto.data).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
