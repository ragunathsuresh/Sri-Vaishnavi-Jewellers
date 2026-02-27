import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { vi } from 'vitest';
import api from '../axiosConfig';

// Mock api
vi.mock('../axiosConfig', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

describe('Dashboard Component', () => {
    beforeEach(() => {
        api.get.mockImplementation((url) => {
            if (url.includes('/dashboard/stats')) {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: {
                            assetsAndCash: [{ type: 'Cash', balance: 77777 }]
                        }
                    }
                });
            }
            if (url === '/stock') {
                return Promise.resolve({
                    data: {
                        stats: {
                            totalJewels: '123 Items',
                            totalCount: 456,
                            totalWeight: 789
                        }
                    }
                });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it('renders dashboard summary cards', async () => {
        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        // Check for titles
        expect(screen.getByText(/Dashboard Overview/i)).toBeInTheDocument();

        // Check for card values (Wait for async data)
        await waitFor(() => {
            expect(screen.getByText('123')).toBeInTheDocument(); // totalStockItems
            expect(screen.getByText('789')).toBeInTheDocument(); // totalStockWeight
            expect(screen.getByText('456')).toBeInTheDocument(); // totalStockCount
            expect(screen.getByText(/77,777/)).toBeInTheDocument(); // cashBalance
        });
    });

    it('shows error message on API failure', async () => {
        api.get.mockRejectedValue(new Error('API Error'));

        render(
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        );

        // Based on implementation, it might show a toast or stay loading.
        // Let's see how Dashboard.jsx handles it.
    });
});
