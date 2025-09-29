
import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            <p>
                Esta app utiliza tu geolocalización para guiarte en la ruta. Tus datos de ubicación no se guardan.
            </p>
            <p className="mt-1">
                <a href="#" className="underline hover:text-blue-500">Política de Privacidad</a>
            </p>
        </footer>
    );
};
