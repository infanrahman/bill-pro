import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface Shortcut {
 id: string;
 keys: string[]; // e.g., ['Control', 's'], or ['F9']
 description: string;
 action: KeyHandler;
 scope?: string; // 'global' or specific page
}

interface KeyboardContextType {
 registerShortcut: (shortcut: Shortcut) => void;
 unregisterShortcut: (id: string) => void;
 shortcuts: Shortcut[];
}

const KeyboardContext = createContext<KeyboardContextType | undefined>(undefined);

export const KeyboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);

 const registerShortcut = useCallback((shortcut: Shortcut) => {
 setShortcuts(prev => {
 // Avoid duplicates by ID
 if (prev.find(s => s.id === shortcut.id)) return prev;
 return [...prev, shortcut];
 });
 }, []);

 const unregisterShortcut = useCallback((id: string) => {
 setShortcuts(prev => prev.filter(s => s.id !== id));
 }, []);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 // Avoid triggering if inside input/textarea UNLESS it's a function key or specific modifier combo
 // But for"Tally-like", we often want F-keys to work everywhere.
 // Check active element?
 const target = e.target as HTMLElement;
 const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

 shortcuts.forEach(shortcut => {
 const mainKey = shortcut.keys[shortcut.keys.length - 1];
 const modifiers = shortcut.keys.slice(0, -1);

 const keyMatch = e.key.toLowerCase() === mainKey.toLowerCase();
 const ctrlMatch = modifiers.includes('Control') ? e.ctrlKey : true;
 const altMatch = modifiers.includes('Alt') ? e.altKey : true;
 const shiftMatch = modifiers.includes('Shift') ? e.shiftKey : true;

 // Exact modifier match logic requires checking if OTHER modifiers aren't pressed, 
 // but usually inclusive is fine for simple apps.

 // Special case: If input is focused, only allow F-keys or Ctrl/Alt combos, ignore simple letters
 if (isInput && !e.ctrlKey && !e.altKey && !e.key.startsWith('F')) {
 return;
 }

 if (keyMatch && ctrlMatch && altMatch && shiftMatch) {

 // Check strict modifiers if needed. For now, simple match.
 if (modifiers.includes('Control') && !e.ctrlKey) return;

 e.preventDefault();
 shortcut.action(e);
 }
 });
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [shortcuts]);

 const contextValue = useMemo(() => ({ registerShortcut, unregisterShortcut, shortcuts }), [registerShortcut, unregisterShortcut, shortcuts]);

 return (
 <KeyboardContext.Provider value={contextValue}>
 {children}
 </KeyboardContext.Provider>
);
};

export const useKeyboard = () => {
 const context = useContext(KeyboardContext);
 if (!context) {
 throw new Error('useKeyboard must be used within a KeyboardProvider');
 }
 return context;
};
