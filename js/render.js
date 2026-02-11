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

    // 4. Exportação Profissional para Excel/CSV (Versão Cirúrgica)
    exportToCSV() {
        // 1. Captura todas as linhas visíveis na tabela
        const rows = Array.from(document.querySelectorAll("table tbody tr"));

        if (rows.length === 0) {
            alert("A tabela está vazia! Não há dados para exportar.");
            return;
        }

        // 2. Pega informações do Evento (que estão no título do dropdown)
        const select = document.getElementById('filter-institution');
        let eventName = "Evento";
        let eventDate = "";
        
        if (select && select.selectedIndex >= 0) {
            const text = select.options[select.selectedIndex].text;
            // O texto é "Nome do Evento — 10/02/2026"
            // Vamos separar pelo travessão
            const parts = text.split('—');
            if (parts.length >= 2) {
                eventName = parts[0].trim();
                eventDate = parts[1].trim();
            } else {
                eventName = text;
            }
        }

        // 3. Extrai os dados linha por linha (Cirurgia nos elementos HTML)
        let data = rows.map(row => {
            // Em vez de pegar o texto todo, pegamos os elementos específicos pelas classes
            const nameEl = row.querySelector(".text-slate-800"); // Classe do Nome
            const schoolEl = row.querySelector(".text-blue-500"); // Classe da Escola
            const cols = row.querySelectorAll("td"); // Para pegar CPF e Hora
            
            return {
                nome: nameEl ? nameEl.innerText.trim() : "Sem Nome",
                // Removemos quebras de linha da escola para garantir
                escola: schoolEl ? schoolEl.innerText.replace(/[\r\n]+/g, " ").trim() : "Sem Escola",
                cpf: cols[1]?.innerText.trim() || "",
                hora: cols[2]?.innerText.trim() || "",
                local: eventName,
                data: eventDate
            };
        });

        // 4. Ordena alfabeticamente por ESCOLA
        data.sort((a, b) => a.escola.localeCompare(b.escola));

        // 5. Monta o CSV (Excel Brasileiro usa ponto e vírgula ;)
        let csvContent = "Nº;NOME COMPLETO;CPF;ESCOLA / LOTAÇÃO;LOCAL DO EVENTO;DATA;HORA\n";

        data.forEach((item, index) => {
            const linha = [
                index + 1,        // Nº
                item.nome,        // Nome Limpo
                `'${item.cpf}`,   // CPF (com aspas para não perder zero)
                item.escola,      // Escola Separada
                item.local,       // Nome do Evento
                item.data,        // Data do Evento
                item.hora         // Hora do Registro
            ].join(";");

            csvContent += linha + "\n";
        });

        // 6. Gera o download com suporte a Acentos (BOM)
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const hoje = new Date().toISOString().slice(0,10);
        link.setAttribute("href", url);
        link.setAttribute("download", `Lista_Presenca_${hoje}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // 5. Gestão de Escolas Cadastradas
    async schoolList() {
        const container = document.getElementById('school-list-container');
        if (!container) return;

        const schools = await Storage.getSchools();
        container.innerHTML = schools.length === 0 ? '<p class="text-xs italic text-slate-400 p-2">Nenhuma escola cadastrada.</p>' : '';

        schools.forEach(school => {
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

/** * Ações Globais Disponíveis para o HTML (onClick) */
window.deleteEntry = async (p) => { 
    if(confirm("🗑️ Tem certeza? Isso excluirá permanentemente o registro deste participante.")) {
        await remove(ref(db, `frequencias/${p}`)); 
    }
};

window.deleteSchool = async (n) => {
    if(confirm(`🗑️ Remover "${n}" da lista oficial de escolas?`)) {
        const key = Storage.sanitizeKey(n);
        await remove(ref(db, `escolas_oficiais/${key}`));
        Render.schoolList();
    }
};

window.deleteEvent = async (path) => {
    if (!path || path === 'all') return alert("Selecione um evento válido.");
    
    const [instKey, date] = path.split('/');
    
    if (!confirm(`Deseja encerrar o evento de ${instKey} (${date})?\n\nEle sairá do menu dos alunos, mas a lista de presença ficará salva no Banco de Dados.`)) {
        return;
    }

    try {
        await remove(ref(db, `eventos_ativos/${date}/${instKey}`));
        alert("Evento encerrado! A lista de presença continua salva no banco de dados.");
        window.location.reload();

    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao encerrar evento.");
    }
};

export { Render };