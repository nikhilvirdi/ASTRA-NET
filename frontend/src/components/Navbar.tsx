import { Link, useLocation } from 'react-router-dom';
import { Sun, Globe, Orbit, Activity, Clock } from 'lucide-react';

export default function Navbar() {
    const location = useLocation();

    const navItems = [
        { path: '/', name: 'Dashboard', icon: <Activity className="w-4 h-4 mr-2" /> },
        { path: '/solar', name: 'Astra-Aditya', icon: <Sun className="w-4 h-4 mr-2" /> },
        { path: '/earth', name: 'Astra-Bhumi', icon: <Globe className="w-4 h-4 mr-2" /> },
        { path: '/orbital', name: 'Astra-Kaksha', icon: <Orbit className="w-4 h-4 mr-2" /> },
        { path: '/history', name: 'History', icon: <Clock className="w-4 h-4 mr-2" /> },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 h-16 bg-gray-950/80 backdrop-blur-md border-b border-gray-800 z-50 flex items-center px-6">
            <div className="flex items-center space-x-2 mr-8">
                <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                    A
                </div>
                <span className="text-xl font-bold tracking-widest text-white">ASTRA-NET</span>
            </div>

            <div className="hidden md:flex space-x-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium ${isActive
                                    ? 'bg-gray-800 text-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
                                }`}
                        >
                            {item.icon}
                            {item.name}
                        </Link>
                    );
                })}
            </div>

            <div className="ml-auto flex items-center space-x-4">
                <div className="px-3 py-1 rounded bg-green-950/30 border border-green-800/50 flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs text-green-400 font-mono tracking-wider">SYSTEMS NOMINAL</span>
                </div>
            </div>
        </nav>
    );
}
