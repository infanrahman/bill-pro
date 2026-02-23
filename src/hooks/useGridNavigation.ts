import { useState, useCallback } from 'react';

interface GridNavigationOptions {
    rows: number;
    cols: number;
    onSelect?: (row: number, col: number) => void;
    loop?: boolean;
}

export const useGridNavigation = (options: GridNavigationOptions) => {
    const { rows, cols, loop = false } = options;
    const [focusedCell, setFocusedCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });

    // We can use refs map or IDs. IDs are easier for dynamic lists if we enforce a naming convention.
    // Convention: `grid-cell-${row}-${col}`

    const handleKeyDown = useCallback((e: React.KeyboardEvent, currentRow: number, currentCol: number) => {
        let nextRow = currentRow;
        let nextCol = currentCol;
        let handled = false;

        switch (e.key) {
            case 'ArrowUp':
                nextRow = currentRow - 1;
                handled = true;
                break;
            case 'ArrowDown':
                nextRow = currentRow + 1;
                handled = true;
                break;
            case 'ArrowLeft':
                nextCol = currentCol - 1;
                handled = true;
                break;
            case 'ArrowRight':
                nextCol = currentCol + 1;
                handled = true;
                break;
            default:
                break;
        }

        if (handled) {
            e.preventDefault();

            // Boundary checks
            if (nextRow < 0) nextRow = loop ? rows - 1 : 0;
            if (nextRow >= rows) nextRow = loop ? 0 : rows - 1;

            if (nextCol < 0) nextCol = loop ? cols - 1 : 0;
            if (nextCol >= cols) nextCol = loop ? 0 : cols - 1;

            setFocusedCell({ row: nextRow, col: nextCol });

            // Focus the element
            setTimeout(() => { // Small tick to allow render if needed, or just focus immediately
                const el = document.getElementById(`grid-cell-${nextRow}-${nextCol}`);
                if (el) el.focus();
            }, 0);
        }
    }, [rows, cols, loop]);

    // Helper to generate props for a cell
    const getGridCellProps = (row: number, col: number) => ({
        id: `grid-cell-${row}-${col}`,
        tabIndex: focusedCell.row === row && focusedCell.col === col ? 0 : -1,
        onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(e, row, col),
        onClick: () => {
            setFocusedCell({ row, col });
        },
        // Auto-focus logic can be handled by effect or simple conditional ref callback, 
        // but tabIndex 0 + explicit focus call in handler is usually robust.
    });

    return {
        focusedCell,
        setFocusedCell,
        handleKeyDown,
        getGridCellProps
    };
};
