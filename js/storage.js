/**
 * js/storage.js - O Motor do Sistema (Firebase)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRBq3_7Lj_CR8-IFs6NIZ3t8pFtTGhij0",
  authDomain: "frequencia-buique.firebaseapp.com",
  databaseURL: "https://frequencia-buique-default-rtdb.firebaseio.com",
  projectId: "frequencia-buique",
  storageBucket: "frequencia-buique.firebasestorage.app",
  messagingSenderId: "757500707726",
  appId: "1:757500707726:web:affe8d00014d70f51fdadf",
  measurementId: "G-R663T5EWRD"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const Storage = {
    // Limpa nomes de chaves para o Firebase
    sanitizeKey(text) {
        return text.normalize("NFD")
                   .replace(/[\u0300-\u036f]/g, "")
                   .replace(/[^\w\s]/gi, '')
                   .replace(/\s+/g, '_');
    },

    // Salva a presença do aluno
    async save(entry) {
        const instKey = this.sanitizeKey(entry.institution);
        const path = `frequencias/${instKey}/${entry.date}`;
        const listRef = ref(db, path);
        const newEntryRef = push(listRef);
        await set(newEntryRef, entry);
    },

    // Cria um evento oficial (Admin)
    async createEvent(institution, date) {
        const instKey = this.sanitizeKey(institution);
        const path = `eventos_ativos/${date}/${instKey}`;
        await set(ref(db, path), { name: institution, date: date });
    },

    // Busca eventos ativos por data
    async getEventsByDate(targetDate) {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `eventos_ativos/${targetDate}`));
        return snapshot.exists() ? Object.values(snapshot.val()) : [];
    },

    // Salva uma escola oficial
    async saveSchool(name) {
        const schoolKey = this.sanitizeKey(name);
        await set(ref(db, `escolas_oficiais/${schoolKey}`), name);
    },

    // Busca lista de escolas
    async getSchools() {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `escolas_oficiais`));
        if (snapshot.exists()) {
            return Object.values(snapshot.val()).sort();
        }
        return [];
    }
};

export { Storage, db };