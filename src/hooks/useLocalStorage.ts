"use client";

import { useState, useEffect } from "react";

// Hook personalizado para persistencia
export function useLocalStorage<T>(key: string, initialValue: T) {
    const [storedValue, setStoredValue] = useState<T>(initialValue);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const handleStorageChange = () => {
            try {
                const item = window.localStorage.getItem(key);
                if (item) {
                    setStoredValue(JSON.parse(item));
                }
            } catch (error) {
                console.error(error);
            }
        };

        handleStorageChange();
        setIsLoaded(true);
        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("local-storage-update", handleStorageChange);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("local-storage-update", handleStorageChange);
        };
    }, [key]);

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
            window.dispatchEvent(new Event("local-storage-update"));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue, isLoaded] as const;
}
