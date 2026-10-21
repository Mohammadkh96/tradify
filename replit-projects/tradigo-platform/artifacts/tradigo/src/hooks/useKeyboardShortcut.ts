import { useEffect } from 'react';

interface ShortcutOptions {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: (e: KeyboardEvent) => void;
}

export const useKeyboardShortcut = (shortcuts: ShortcutOptions[]) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts inside input/textarea unless it's Escape or Cmd+K
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      for (const shortcut of shortcuts) {
        const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const isMetaOrCtrlRequested = shortcut.metaKey || shortcut.ctrlKey;
        const hasMetaOrCtrl = e.metaKey || e.ctrlKey;

        const metaMatch = isMetaOrCtrlRequested ? hasMetaOrCtrl : !hasMetaOrCtrl;
        const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.altKey ? e.altKey : !e.altKey;

        if (matchesKey && metaMatch && shiftMatch && altMatch) {
          if (isInput && shortcut.key.toLowerCase() !== 'k' && e.key !== 'Escape') {
            continue;
          }
          if (isMetaOrCtrlRequested || shortcut.key === 'Escape') {
            e.preventDefault();
          }
          shortcut.handler(e);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};
