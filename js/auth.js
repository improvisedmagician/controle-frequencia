// Arquivo de Segurança do Admin

export const Auth = {
    
    secretHash: "10b89693630f576e33642398555e094760811e9f137e7355106ce60322dfc9df",

    // Função que verifica a senha sem revelar qual é
    async check(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex === this.secretHash;
    },

    // Função que inicia o processo de login
    async login() {
        if (sessionStorage.getItem('admin_logged') === 'true') return true;

        const attempt = prompt("🔒 Área Restrita. Digite a senha de Admin:");
        
        if (!attempt) {
            window.location.href = "index.html";
            return false;
        }

        const isValid = await this.check(attempt);

        if (isValid) {
            sessionStorage.setItem('admin_logged', 'true');
            return true;
        } else {
            alert("⛔ Senha Incorreta!");
            window.location.href = "index.html";
            return false;
        }
    },

    logout() {
        sessionStorage.removeItem('admin_logged');
        window.location.href = "index.html";
    }
};