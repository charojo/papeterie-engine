import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useHistory } from '../useHistory';

describe('useHistory', () => {
    class MockCommand {
        constructor(name) {
            this.name = name;
            this.executed = 0;
            this.undone = 0;
        }
        async execute() { this.executed++; }
        async undo() { this.undone++; }
    }

    it('manages undo and redo stacks correctly', async () => {
        const { result } = renderHook(() => useHistory());
        const cmd1 = new MockCommand('cmd1');
        const cmd2 = new MockCommand('cmd2');

        // Execute first command
        await act(async () => {
            await result.current.execute(cmd1);
        });
        expect(result.current.undoStack.length).toBe(1);
        expect(result.current.redoStack.length).toBe(0);
        expect(cmd1.executed).toBe(1);
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);

        // Execute second command
        await act(async () => {
            await result.current.execute(cmd2);
        });
        expect(result.current.undoStack.length).toBe(2);
        expect(cmd2.executed).toBe(1);

        // Undo
        await act(async () => {
            await result.current.undo();
        });
        expect(result.current.undoStack.length).toBe(1);
        expect(result.current.redoStack.length).toBe(1);
        expect(cmd2.undone).toBe(1);
        expect(result.current.canRedo).toBe(true);

        // Redo
        await act(async () => {
            await result.current.redo();
        });
        expect(result.current.undoStack.length).toBe(2);
        expect(result.current.redoStack.length).toBe(0);
        expect(cmd2.executed).toBe(2);
    });

    it('clears redo stack on new execution', async () => {
        const { result } = renderHook(() => useHistory());
        const cmd1 = new MockCommand('cmd1');
        const cmd3 = new MockCommand('cmd3');

        await act(async () => {
            await result.current.execute(cmd1);
        });
        await act(async () => {
            await result.current.undo();
        });
        expect(result.current.redoStack.length).toBe(1);

        await act(async () => {
            await result.current.execute(cmd3);
        });
        expect(result.current.redoStack.length).toBe(0);
    });

    it('respects maxHistory limit', async () => {
        const { result } = renderHook(() => useHistory(2));
        const cmd1 = new MockCommand('1');
        const cmd2 = new MockCommand('2');
        const cmd3 = new MockCommand('3');

        await act(async () => {
            await result.current.execute(cmd1);
            await result.current.execute(cmd2);
            await result.current.execute(cmd3);
        });

        expect(result.current.undoStack.length).toBe(2);
        expect(result.current.undoStack[0].name).toBe('2');
        expect(result.current.undoStack[1].name).toBe('3');
    });
});
