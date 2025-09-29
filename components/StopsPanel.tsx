
import React from 'react';
import type { Stop, Progress } from '../types';
import { StopCard } from './StopCard';

interface StopsPanelProps {
    stops: Stop[];
    progress: Progress;
    nextStopId: string | null;
    onToggleDone: (stopId: string) => void;
    onGoToStop: (stopId: string) => void;
}

export const StopsPanel: React.FC<StopsPanelProps> = ({ stops, progress, nextStopId, onToggleDone, onGoToStop }) => {
    return (
        <div className="flex-grow overflow-y-auto p-4 bg-gray-100 dark:bg-gray-900">
            <div className="space-y-4">
                {stops.map(stop => (
                    <StopCard
                        key={stop.id}
                        stop={stop}
                        isDone={!!progress[stop.id]}
                        isNext={stop.id === nextStopId}
                        onToggleDone={() => onToggleDone(stop.id)}
                        onGoToStop={() => onGoToStop(stop.id)}
                    />
                ))}
            </div>
        </div>
    );
};
