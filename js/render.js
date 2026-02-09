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

            document.getElementById('total-registrations').textContent = totalGlobal;
            document.getElementById('active-sessions').textContent = totalEventos;
            document.getElementById('total-schools') ? document.getElementById('total-schools').textContent = schoolSnap.exists() ? Object.keys(schoolSnap.val()).length : 0 : null;
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
            Object.keys(dates).forEach(date => {
                const events = dates[date];
                Object.keys(events).forEach(instKey => {
                    const event = events[instKey];
                    const option = document.createElement('option');
                    option.value = `${instKey}/${date}`; 
                    option.textContent = `${event.name} — ${date.split('-').reverse().join('/')}`;
                    select.appendChild(option);
                });
            });
        }
        this.updateStats();
    },

    // 3. Renderização da Tabela com monitoramento em tempo real
    table(path) {
        const tableBody = document.getElementById('frequencies-table-body');
        const badge = document.getElementById('showing-count-badge');
        const presentNow = document.getElementById('present-now');
        
        if (!tableBody || path === 'all') {
            tableBody.innerHTML = '<tr><td colspan="4" class="py-20 text-center text-slate-400">Selecione uma lista no menu acima.</td></tr>';
            return;
        }

        const listRef = ref(db, `frequencias/${path}`);
        
        onValue(listRef, (snapshot) => {
            tableBody.innerHTML = '';
            if (snapshot.exists()) {
                const entries = Object.entries(snapshot.val());
                entries.forEach(([id, freq]) => {
                    const initial = freq.name.charAt(0).toUpperCase();
                    tableBody.innerHTML += `
                        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td class="px-6 py-4 flex items-center">
                                <div class="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm mr-3 shadow-sm">${initial}</div>
                                <div>
                                    <div class="text-sm font-bold text-slate-800 uppercase">${freq.name}</div>
                                    <div class="text-[10px] text-blue-500 font-black uppercase tracking-wider">${freq.userOrigin}</div>
                                </div>
                            </td>
                            <td class="px-6 py-4 text-sm font-mono text-slate-600">${freq.cpf}</td>
                            <td class="px-6 py-4 text-center">
                                <span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold">
                                    <i class="far fa-clock mr-1"></i>${freq.time}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-center">
                                <button onclick="window.deleteEntry('${path}/${id}')" class="text-slate-300 hover:text-red-500 transition-colors">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </td>
                        </tr>`;
                });
                if (badge) badge.textContent = `${entries.length} NOMES`;
                if (presentNow) presentNow.textContent = entries.length;
            } else {
                tableBody.innerHTML = '<tr><td colspan="4" class="py-12 text-center text-slate-400 italic">Lista vazia.</td></tr>';
                if (presentNow) presentNow.textContent = '0';
            }
        });
    },

    // 4. Exportação Profissional para Excel/CSV
    async exportToCSV() {
        const path = document.getElementById('filter-institution').value;
        if (path === 'all') return alert('Selecione uma lista primeiro.');

        const snapshot = await get(ref(db, `frequencias/${path}`));
        if (!snapshot.exists()) return alert('Não há dados para exportar.');

        const data = Object.values(snapshot.val());
        let csv = "\uFEFFNome;CPF;Escola;Local;Data;Hora\n";
        
        data.forEach(f => {
            csv += `${f.name};${f.cpf};${f.userOrigin};${f.institution};${f.date};${f.time}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Frequencia_Buique_${path.replace('/', '_')}.csv`;
        link.click();
    },

    // 5. Gestão de Escolas Cadastradas
    async schoolList() {
        const container = document.getElementById('school-list-container');
        if (!container) return;

        const schools = await Storage.getSchools();
        container.innerHTML = schools.length === 0 ? '<p class="text-xs italic text-gray-400">Nenhuma escola cadastrada.</p>' : '';

        schools.forEach(school => {
            container.innerHTML += `
                <div class="flex justify-between items-center bg-slate-50 border border-slate-200 p-2 rounded-lg">
                    <span class="text-xs font-medium text-slate-700 truncate mr-2">${school}</span>
                    <button onclick="window.deleteSchool('${school}')" class="text-slate-300 hover:text-red-500">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </div>`;
        });
        this.updateStats();
    }
};

/** Ações Globais Disponíveis para o HTML **/
window.deleteEntry = async (p) => { 
    if(confirm("Excluir este participante da nuvem?")) await remove(ref(db, `frequencias/${p}`)); 
};

window.deleteSchool = async (n) => {
    if(confirm(`Remover "${n}" da lista oficial?`)) {
        const key = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
        await remove(ref(db, `escolas_oficiais/${key}`));
        Render.schoolList();
    }
};

window.deleteEvent = async (path) => {
    if (!path || path === 'all') return alert("Selecione um evento válido.");
    const [instKey, date] = path.split('/');
    if (confirm(`Deseja desativar este ponto de frequência?`)) {
        await remove(ref(db, `eventos_ativos/${date}/${instKey}`));
        location.reload();
    }
};

export { Render };