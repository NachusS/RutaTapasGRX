
import React from 'react';
import type { Stop } from '../types';

interface StopCardProps {
    stop: Stop;
    isDone: boolean;
    isNext: boolean;
    onToggleDone: () => void;
    onGoToStop: () => void;
}

export const StopCard: React.FC<StopCardProps> = ({ stop, isDone, isNext, onToggleDone, onGoToStop }) => {
    const cardClasses = `
        bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transition-all duration-300
        ${isDone ? 'opacity-60' : ''}
        ${isNext ? 'ring-2 ring-blue-500 scale-105' : 'ring-1 ring-gray-200 dark:ring-gray-700'}
    `;

    return (
        <div id={`stop-${stop.id}`} className={cardClasses}>
            <div className="md:flex">
                <div className="md:flex-shrink-0">
                    <img className="h-48 w-full object-cover md:w-32" src={stop.photo} alt={`Foto de ${stop.name}`} />
                </div>
                <div className="p-4 flex flex-col justify-between flex-grow">
                    <div>
                        <div className="uppercase tracking-wide text-sm text-blue-500 dark:text-blue-400 font-semibold">Parada {stop.order}</div>
                        <p className="block mt-1 text-lg leading-tight font-medium text-black dark:text-white">{stop.name}</p>
                        <p className="mt-2 text-gray-500 dark:text-gray-400"><strong>Tapa:</strong> {stop.tapa}</p>
                        {stop.address && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stop.address}</p>}
                    </div>
                    <div className="mt-4 flex gap-2 justify-end">
                        <button
                            onClick={onGoToStop}
                            className="px-3 py-1 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={`Navegar a ${stop.name}`}
                        >
                            Ir a esta parada
                        </button>
                        <button
                            onClick={onToggleDone}
                            className={`px-3 py-1 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                                ${isDone ? 
                                'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500' :
                                'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 focus:ring-gray-400'}
                            `}
                            aria-pressed={isDone}
                        >
                            {isDone ? 'Hecha' : 'Marcar como hecha'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
