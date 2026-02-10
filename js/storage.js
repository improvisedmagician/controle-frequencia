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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const Storage = {
    sanitizeKey(text) {
        if (!text) return 'indefinido';
        return text.normalize("NFD")
                   .replace(/[\u0300-\u036f]/g, "")
                   .replace(/[^\w\s]/gi, '')
                   .replace(/\s+/g, '_');
    },

    async save(entry) {
        try {
            const instKey = this.sanitizeKey(entry.institution);
            const path = `frequencias/${instKey}/${entry.date}`;
            const listRef = ref(db, path);
            const newEntryRef = push(listRef);
            await set(newEntryRef, entry);
            return true;
        } catch (error) {
            console.error("Erro ao salvar frequência:", error);
            throw error;
        }
    },

    async createEvent(institution, date) {
        const instKey = this.sanitizeKey(institution);
        const path = `eventos_ativos/${date}/${instKey}`;
        await set(ref(db, path), { name: institution, date: date });
    },

    async getEventsByDate(targetDate) {
        try {
            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, `eventos_ativos/${targetDate}`));
            return snapshot.exists() ? Object.values(snapshot.val()) : [];
        } catch (error) {
            console.error("Erro ao buscar eventos:", error);
            return [];
        }
    },

    async saveSchool(name) {
        const schoolKey = this.sanitizeKey(name);
        await set(ref(db, `escolas_oficiais/${schoolKey}`), name);
    },

    async getSchools() {
        try {
            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, `escolas_oficiais`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                // Garante que retorne um array de strings ordenado
                return Object.values(data).sort((a, b) => a.localeCompare(b));
            }
            return [];
        } catch (error) {
            console.error("Erro ao buscar escolas:", error);
            return [];
        }
    }
};

export { Storage, db };