import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SalesEntry from './SalesEntry';
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

describe('SalesEntry Component', () => {
    beforeEach(() => {
        // Mock initial data calls (like gold rate or customer search)
        api.get.mockImplementation((url) => {
            if (url.includes('/dashboard/gold-rate')) {
                return Promise.resolve({ data: { data: { rate: 6250 } } });
            }
            if (url.includes('/sales/customer/search')) {
                return Promise.resolve({ data: { success: true, data: [] } });
            }
            if (url.includes('/stock/search')) {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: [{ serialNo: 'S1', itemName: 'Mock Ring', currentCount: 1, netWeight: 5, purity: '22K' }]
                    }
                });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it('renders the sales entry form', () => {
        render(
            <MemoryRouter>
                <SalesEntry />
            </MemoryRouter>
        );

        expect(screen.getByText(/Advanced Sales Entry/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Type name.../i)).toBeInTheDocument();
    });

    it('can search for a stock item and add it to the list', async () => {
        render(
            <MemoryRouter>
                <SalesEntry />
            </MemoryRouter>
        );

        // Mock the specific item fetch response
        api.get.mockImplementation((url) => {
            if (url.includes('/stock/serial/S1')) {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: { serialNo: 'S1', itemName: 'Mock Ring', jewelleryType: 'Ring', purity: '22K', netWeight: 5, currentCount: 1 }
                    }
                });
            }
            if (url.includes('/dashboard/gold-rate')) {
                return Promise.resolve({ data: { data: { rate: 6250 } } });
            }
            if (url.includes('/sales/customer/search')) {
                return Promise.resolve({ data: { success: true, data: [] } });
            }
            return Promise.resolve({ data: { data: {} } });
        });

        const searchInput = screen.getByPlaceholderText(/Enter item no/i);
        fireEvent.change(searchInput, { target: { value: 'S1' } });
        fireEvent.blur(searchInput);

        // Wait for item details to be populated
        await waitFor(() => {
            expect(screen.getByDisplayValue('Mock Ring')).toBeInTheDocument();
        });
    });
});
