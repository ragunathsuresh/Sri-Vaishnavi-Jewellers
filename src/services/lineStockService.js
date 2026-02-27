import api from '../axiosConfig';

export const lineStockService = {
    create: async (data) => {
        const response = await api.post('/line-stock/create', data);
        return response.data;
    },
    getAll: async (params) => {
        const response = await api.get('/line-stock', { params });
        return response.data;
    },
    getById: async (id) => {
        const response = await api.get(`/line-stock/${id}`);
        return response.data;
    },
    settle: async (id, data) => {
        const response = await api.put(`/line-stock/settle/${id}`, data);
        return response.data;
    }
};

export const stockService = {
    getAll: async () => {
        const response = await api.get('/stock');
        return response.data?.data || [];
    }
};
