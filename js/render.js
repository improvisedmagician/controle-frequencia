/**
 * js/render.js - O Cérebro Visual (Interface e Firebase)
 */
import { Storage, db } from './storage.js';
import { ref, onValue, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const Render = {
    // 1. Dashboard: Contagem de registros e escolas
    async updateStats() {
        try {
            const freqSnap = await get(ref(db, 'frequencias'));
            const schoolSnap = await get(ref(db, 'escolas_oficiais'));
            const eventSnap = await get(ref(db, 'eventos_ativos'));

            let totalGlobal = 0;
            let totalEventos = 0;

            if (freqSnap.exists()) {
                const data = freqSnap.val();
                Object.keys(data).forEach(inst => {
                    Object.keys(data[inst]).forEach(date => {
                        totalGlobal += Object.keys(data[inst][date]).length;
                    });
                });
            }

            if (eventSnap.exists()) {
                const dates = eventSnap.val();
                Object.keys(dates).forEach(d => totalEventos += Object.keys(dates[d]).length);
            }

            // Atualiza os contadores na tela se os elementos existirem
            const elTotal = document.getElementById('total-registrations');
            const elActive = document.getElementById('active-sessions');
            const elSchools = document.getElementById('total-schools');

            if (elTotal) elTotal.textContent = totalGlobal;
            if (elActive) elActive.textContent = totalEventos;
            if (elSchools) elSchools.textContent = schoolSnap.exists() ? Object.keys(schoolSnap.val()).length : 0;
            
        } catch (e) { console.error("Erro ao carregar estatísticas:", e); }
    },

    // 2. Seletor de Eventos (Dropdown do Admin)
    async updateSessionSelector() {
        const select = document.getElementById('filter-institution');
        if (!select) return;

        const snapshot = await get(ref(db, 'eventos_ativos'));
        select.innerHTML = '<option value="all">🔍 Selecione o Evento para Gerenciar...</option>';

        if (snapshot.exists()) {
            const dates = snapshot.val();
            // Ordena as datas da mais recente para a mais antiga
            Object.keys(dates).sort().reverse().forEach(date => {
                const events = dates[date];
                Object.keys(events).forEach(instKey => {
                    const event = events[instKey];
                    const option = document.createElement('option');
                    // Cria o value no formato: chave_escola/data (ex: colegio_municipal/2026-02-10)
                    option.value = `${instKey}/${date}`; 
                    option.textContent = `${event.name} — ${date.split('-').reverse().join('/')}`;
                    select.appendChild(option);
                });
            });
        }
        this.updateStats();
    },

    // 3. Renderização da Tabela com monitoramento em tempo real (Realtime)
    table(path) {
        const tableBody = document.getElementById('frequencies-table-body');
        const badge = document.getElementById('showing-count-badge');
        const presentNow = document.getElementById('present-now');
        
        if (!tableBody || path === 'all') {
            tableBody.innerHTML = '<tr><td colspan="4" class="py-20 text-center text-slate-400 italic">Selecione uma lista no menu acima para carregar.</td></tr>';
            if (badge) badge.textContent = "AGUARDANDO SELEÇÃO";
            return;
        }

        const listRef = ref(db, `frequencias/${path}`);
        
        // onValue mantém a conexão aberta para atualizações ao vivo
        onValue(listRef, (snapshot) => {
            tableBody.innerHTML = '';
            if (snapshot.exists()) {
                const entries = Object.entries(snapshot.val());
                
                entries.forEach(([id, freq]) => {
                    const initial = freq.name.charAt(0).toUpperCase();
                    tableBody.innerHTML += `
                        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 group">
                            <td class="px-6 py-4 flex items-center">
                                <div class="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mr-3 shadow-sm group-hover:scale-110 transition-transform">${initial}</div>
                                <div>
                                    <div class="text-sm font-bold text-slate-800 uppercase">${freq.name}</div>
                                    <div class="text-[10px] text-blue-500 font-black uppercase tracking-wider">${freq.userOrigin}</div>
                                </div>
                            </td>
                            <td class="px-6 py-4 text-sm font-mono text-slate-600">${freq.cpf}</td>
                            <td class="px-6 py-4 text-center">
                                <span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">
                                    <i class="far fa-clock mr-1"></i>${freq.time}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-center">
                                <button onclick="window.deleteEntry('${path}/${id}')" class="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50" title="Excluir registro">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </td>
                        </tr>`;
                });
                
                if (badge) badge.textContent = `${entries.length} REGISTROS`;
                if (presentNow) presentNow.textContent = entries.length;
            } else {
                tableBody.innerHTML = '<tr><td colspan="4" class="py-12 text-center text-slate-400 italic">Lista vazia. Aguardando registros...</td></tr>';
                if (badge) badge.textContent = "ZERO REGISTROS";
                if (presentNow) presentNow.textContent = '0';
            }
        });
    },

    // 4. Exportação Profissional para Excel/CSV
    async exportToCSV() {
        const path = document.getElementById('filter-institution').value;
        if (!path || path === 'all') return alert('⚠️ Selecione um evento na lista primeiro.');

        const snapshot = await get(ref(db, `frequencias/${path}`));
        if (!snapshot.exists()) return alert('⚠️ Não há dados para exportar neste evento.');

        const data = Object.values(snapshot.val());
        
        // \uFEFF força o Excel a ler como UTF-8 (acentos corretos)
        // Ponto e vírgula (;) é o padrão brasileiro de separação
        let csv = "\uFEFFNome Completo;CPF;Escola de Origem;Local do Evento;Data;Hora do Registro\n";
        
        data.forEach(f => {
            csv += `${f.name};${f.cpf};${f.userOrigin};${f.institution};${f.date};${f.time}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        // Nome do arquivo limpo: Frequencia_Buique_Local_Data.csv
        link.download = `Frequencia_Buique_${path.replace('/', '_')}.csv`;
        link.click();
    },

    // 5. Gestão de Escolas Cadastradas
    async schoolList() {
        const container = document.getElementById('school-list-container');
        if (!container) return;

        const schools = await Storage.getSchools();
        container.innerHTML = schools.length === 0 ? '<p class="text-xs italic text-slate-400 p-2">Nenhuma escola cadastrada.</p>' : '';

        schools.forEach(school => {
            // Usa as classes de grid que definimos no HTML
            container.innerHTML += `
                <div class="flex justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded-xl hover:border-blue-300 transition-colors group">
                    <span class="text-[10px] font-bold text-slate-700 truncate mr-2 uppercase" title="${school}">${school}</span>
                    <button onclick="window.deleteSchool('${school}')" class="text-slate-300 hover:text-red-500 transition-colors">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </div>`;
        });
        this.updateStats();
    }
};

/** * Ações Globais Disponíveis para o HTML (onClick) 
 * Estas funções precisam estar no window para serem chamadas pelo HTML string
 */
window.deleteEntry = async (p) => { 
    if(confirm("🗑️ Tem certeza? Isso excluirá permanentemente o registro deste participante.")) {
        await remove(ref(db, `frequencias/${p}`)); 
        // Não precisa chamar update() porque o onValue faz isso sozinho!
    }
};

window.deleteSchool = async (n) => {
    if(confirm(`🗑️ Remover "${n}" da lista oficial de escolas?`)) {
        // Usa a função centralizada do Storage para garantir a mesma chave
        const key = Storage.sanitizeKey(n);
        await remove(ref(db, `escolas_oficiais/${key}`));
        Render.schoolList();
    }
};

window.deleteEvent = async (path) => {
    if (!path || path === 'all') return alert("Selecione um evento válido para excluir.");
    
    // path vem como: chave_escola/2026-02-10
    const [instKey, date] = path.split('/');
    
    if (confirm(`⚠️ ATENÇÃO!\n\nDeseja encerrar este evento?\nIsso vai ocultar o evento do painel, mas manterá os registros salvos.`)) {
        await remove(ref(db, `eventos_ativos/${date}/${instKey}`));
        window.location.reload();
    }
};

export { Render };