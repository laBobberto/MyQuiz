const API_URL = "http://localhost:8000";

export const api = {
    async get(endpoint: string) {
        const headers: any = { "Content-Type": "application/json" };
        if (localStorage.getItem('token')) {
            headers["Authorization"] = `Bearer ${localStorage.getItem('token')}`;
        }
        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'GET',
                headers,
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            try {
                return await res.json();
            } catch (e) {
                throw new Error('Invalid JSON response from server');
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to fetch');
        }
    },

    async post(endpoint: string, data: any) {
        const headers: any = { "Content-Type": "application/json" };
        if (localStorage.getItem('token')) {
            headers["Authorization"] = `Bearer ${localStorage.getItem('token')}`;
        }
        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
                try {
                    const error = await res.json();
                    errorMessage = error.detail || errorMessage;
                } catch (e) {
                }
                throw new Error(errorMessage);
            }
            try {
                return await res.json();
            } catch (e) {
                throw new Error('Invalid JSON response from server');
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to fetch');
        }
    },

    async put(endpoint: string, data: any) {
        const headers: any = { "Content-Type": "application/json" };
        if (localStorage.getItem('token')) {
            headers["Authorization"] = `Bearer ${localStorage.getItem('token')}`;
        }
        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
                try {
                    const error = await res.json();
                    errorMessage = error.detail || errorMessage;
                } catch (e) {
                }
                throw new Error(errorMessage);
            }
            try {
                return await res.json();
            } catch (e) {
                throw new Error('Invalid JSON response from server');
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to fetch');
        }
    },

    async delete(endpoint: string) {
        const headers: any = { "Content-Type": "application/json" };
        if (localStorage.getItem('token')) {
            headers["Authorization"] = `Bearer ${localStorage.getItem('token')}`;
        }
        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'DELETE',
                headers,
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            try {
                return await res.json();
            } catch (e) {
                throw new Error('Invalid JSON response from server');
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to fetch');
        }
    }
};

export function connectWS(roomCode: string, role: string, onMessage: (data: any) => void, onError?: (error: Event) => void) {
    const ws = new WebSocket(`ws://localhost:8000/ws/${roomCode}/${role}`);
    
    ws.onopen = () => {
        console.log(`WebSocket connected as ${role} in room ${roomCode}`);
    };
    
    ws.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            onMessage(data);
        } catch (err) {
            console.error("Failed to parse WebSocket message:", err);
        }
    };
    
    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (onError) onError(error);
    };
    
    ws.onclose = () => {
        console.log("WebSocket disconnected");
    };
    
    return ws;
}
