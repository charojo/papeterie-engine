import { useState, useCallback } from 'react';

/**
 * Hook to manage a history of commands for undo/redo functionality.
 * 
 * @param {number} maxHistory - Maximum number of commands to store.
 * @returns {object} History management functions and state.
 */
export function useHistory(maxHistory = 50) {
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);

    // Using a ref to track stacks synchronously for internal logic if needed
    // but state is used for React re-renders.

    const execute = useCallback(async (command) => {
        try {
            await command.execute();
            setUndoStack(prev => {
                const next = [...prev, command];
                if (next.length > maxHistory) {
                    next.shift();
                }
                return next;
            });
            setRedoStack([]); // New action clears redo stack
        } catch (error) {
            console.error('Failed to execute command:', error);
            throw error;
        }
    }, [maxHistory]);

    const undo = useCallback(async () => {
        if (undoStack.length === 0) return;

        const command = undoStack[undoStack.length - 1];
        try {
            await command.undo();
            setUndoStack(prev => prev.slice(0, -1));
            setRedoStack(prev => [...prev, command]);
        } catch (error) {
            console.error('Failed to undo command:', error);
        }
    }, [undoStack]);

    const redo = useCallback(async () => {
        if (redoStack.length === 0) return;

        const command = redoStack[redoStack.length - 1];
        try {
            await command.execute();
            setRedoStack(prev => prev.slice(0, -1));
            setUndoStack(prev => [...prev, command]);
        } catch (error) {
            console.error('Failed to redo command:', error);
        }
    }, [redoStack]);

    const canUndo = undoStack.length > 0;
    const canRedo = redoStack.length > 0;

    return {
        execute,
        undo,
        redo,
        canUndo,
        canRedo,
        undoStack,
        redoStack
    };
}
