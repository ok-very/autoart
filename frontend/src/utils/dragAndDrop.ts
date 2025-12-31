import { useState, useCallback } from 'react';

interface DragState {
  isDragging: boolean;
  draggedId: string | null;
  draggedType: string | null;
  overId: string | null;
}

interface DraggableProps {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  className?: string;
}

interface DroppableProps {
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

/**
 * Hook to manage local drag and drop state.
 * Useful for reordering lists or moving items.
 */
export function useDragAndDrop() {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedId: null,
    draggedType: null,
    overId: null,
  });

  const handleDragStart = useCallback((id: string, type: string) => {
    setDragState((prev) => ({
      ...prev,
      isDragging: true,
      draggedId: id,
      draggedType: type,
    }));
  }, []);

  const handleDragOver = useCallback((id: string) => {
    setDragState((prev) => {
      if (prev.overId === id) return prev;
      return { ...prev, overId: id };
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedId: null,
      draggedType: null,
      overId: null,
    });
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}

/**
 * Helper to get standard draggable attributes
 */
export function getDraggableAttributes(
  id: string,
  type: string,
  onDragStart: (id: string, type: string) => void,
  onDragEnd: () => void
): DraggableProps {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ id, type }));
      e.dataTransfer.effectAllowed = 'move';
      onDragStart(id, type);
    },
    onDragEnd: (_e: React.DragEvent) => {
      onDragEnd();
    },
    className: 'cursor-grab active:cursor-grabbing',
  };
}

/**
 * Helper to get standard droppable attributes
 */
export function getDroppableAttributes(
  id: string,
  onDragOver: (id: string) => void,
  onDrop: (sourceId: string, sourceType: string, targetId: string) => void
): DroppableProps {
  return {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault(); // Allow dropping
      e.dataTransfer.dropEffect = 'move';
      onDragOver(id);
    },
    onDragLeave: (_e: React.DragEvent) => {
      // Optional: clear drag over state if needed, but usually handled by enter/leave pairing
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('text/plain');
      if (data) {
        try {
          const { id: sourceId, type: sourceType } = JSON.parse(data);
          onDrop(sourceId, sourceType, id);
        } catch (err) {
          console.error('Failed to parse drag data', err);
        }
      }
    },
  };
}
