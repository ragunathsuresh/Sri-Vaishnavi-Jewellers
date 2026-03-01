import React, { createContext, useState, useEffect, useContext } from 'react';

const DeviceContext = createContext();

export const DeviceProvider = ({ children }) => {
    const [screenSize, setScreenSize] = useState({
        width: window.innerWidth,
        isMobile: window.innerWidth < 640,
        isTablet: window.innerWidth >= 640 && window.innerWidth < 1024,
        isDesktop: window.innerWidth >= 1024
    });

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            setScreenSize({
                width,
                isMobile: width < 640,
                isTablet: width >= 640 && width < 1024,
                isDesktop: width >= 1024
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Removed device-based read-only restriction as per user request for full functionality on all devices.
    const isReadOnly = false;

    return (
        <DeviceContext.Provider value={{ ...screenSize, isReadOnly }}>
            {children}
        </DeviceContext.Provider>
    );
};

export const useDevice = () => useContext(DeviceContext);
