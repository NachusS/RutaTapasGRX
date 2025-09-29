
import React from 'react';

interface HeaderProps {
    title: string;
    completedCount: number;
    totalCount: number;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    onReset: () => void;
    onNextStop: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, completedCount, totalCount, theme, onToggleTheme, onReset, onNextStop }) => {
    const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
        <header className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{title}</h1>
            
            <div className="mt-4" aria-live="polite">
                <div className="flex justify-between items-center text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                    <span>Progreso</span>
                    <span>{completedCount} / {totalCount} Completadas</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
                        style={{ width: `${progressPercentage}%` }}
                        aria-valuenow={progressPercentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        role="progressbar"
                    ></div>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
                <button
                    onClick={onNextStop}
                    className="flex-grow px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition"
                    aria-label="Ir a la siguiente parada pendiente"
                >
                    Siguiente Parada
                </button>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onToggleTheme}
                        className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
                        aria-label={`Activar modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
                    >
                        {theme === 'light' ? SunIcon : MoonIcon}
                    </button>
                    <button
                        onClick={onReset}
                        className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
                        aria-label="Reiniciar progreso"
                    >
                        {ResetIcon}
                    </button>
                </div>
            </div>
        </header>
    );
};

const SunIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const MoonIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
);

const ResetIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 4l16 16" />
    </svg>
);
