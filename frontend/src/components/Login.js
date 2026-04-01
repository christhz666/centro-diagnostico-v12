import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/* ── Starfield Canvas Animation ─────────────────────────── */
function StarfieldCanvas() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animId;
        let stars = [];
        const STAR_COUNT = 180;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                r: Math.random() * 1.8 + 0.3,
                speed: Math.random() * 0.3 + 0.05,
                opacity: Math.random(),
                twinkleSpeed: Math.random() * 0.02 + 0.005,
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            stars.forEach(s => {
                s.opacity += s.twinkleSpeed;
                if (s.opacity > 1 || s.opacity < 0.1) s.twinkleSpeed *= -1;
                s.y -= s.speed;
                if (s.y < -5) { s.y = canvas.height + 5; s.x = Math.random() * canvas.width; }

                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, s.opacity))})`;
                ctx.fill();
            });
            animId = requestAnimationFrame(draw);
        };
        draw();

        return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
    }, []);

    return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}

const Login = ({ onLogin, empresaConfig = {}, authNotice = '' }) => {
    const empresaNombre = empresaConfig.nombre || empresaConfig.empresa_nombre || 'Centro Diagnóstico';
    const empresaSubtitulo = empresaConfig.subtitulo || empresaConfig.empresa_subtitulo || 'Portal Clínico';
    const logoLogin =
        empresaConfig.logo_login ||
        empresaConfig.logo_sidebar ||
        empresaConfig.logo_resultados ||
        empresaConfig.logo_factura ||
        '';

    const [credentials, setCredentials] = useState(() => {
        const savedEmail = localStorage.getItem('rememberedEmail') || localStorage.getItem('rememberedUsername') || '';
        return { email: savedEmail, password: '' };
    });
    const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem('rememberedEmail')));
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCredentials((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await api.login(credentials);
            const user = response.user || response.usuario;
            const token = response.token || response.access_token;
            if (user && token) {
                if (rememberMe) {
                    localStorage.setItem('rememberedEmail', credentials.email);
                    localStorage.setItem('rememberedUsername', credentials.email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                    localStorage.removeItem('rememberedUsername');
                }
                onLogin(user, token, rememberMe);
                navigate('/');
            } else {
                throw new Error('Respuesta de sesión incompleta');
            }
        } catch (err) {
            setError(err.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div 
            className="min-h-screen flex items-center justify-center p-6 antialiased font-body text-[#e1e2eb] relative overflow-hidden"
            style={{ 
                backgroundColor: '#10131a',
                backgroundImage: 'radial-gradient(at 0% 0%, rgba(0, 224, 211, 0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(0, 106, 100, 0.1) 0px, transparent 50%)'
            }}
        >
            <StarfieldCanvas />
            
            <main className="w-full max-w-[440px] relative z-10">
                {/* Brand Header */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-full max-w-[320px] min-h-[92px] rounded-2xl bg-gradient-to-br from-[#4afdef]/20 to-[#00e0d3]/10 flex items-center justify-center mb-6 shadow-[0_0_35px_rgba(0,224,211,0.25)] p-4 border border-[#3df5e7]/20">
                        {logoLogin ? (
                            <img src={logoLogin} alt="Logo" className="max-h-20 w-full object-contain" />
                        ) : (
                            <span className="material-icons-round text-[#00201e] text-4xl">clinical_notes</span>
                        )}
                    </div>
                    <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[#e1e2eb] mb-2">{empresaNombre}</h1>
                    <p className="text-gray-600 dark:text-[#bacac7] font-label text-sm tracking-wide uppercase">{empresaSubtitulo}</p>
                </div>

                {/* Login Card */}
                <div 
                    className="border border-[#3b4a48]/20 rounded-xl p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col gap-6"
                    style={{ background: 'rgba(29, 32, 38, 0.7)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
                >
                    <div className="mb-2">
                        <h2 className="font-headline text-xl font-bold text-[#e1e2eb]">Acceso Seguro</h2>
                        <p className="text-gray-600 dark:text-[#bacac7] text-sm mt-1">Solo personal médico autorizado.</p>
                    </div>

                    {authNotice && !error && (
                        <div className="bg-[#104f4a]/20 text-[#87c0b9] p-3 rounded-lg text-sm flex items-start gap-2 border border-[#104f4a]/50">
                            <span className="material-icons-round text-lg">info</span>
                            <span>{authNotice}</span>
                        </div>
                    )}

                    {error && (
                        <div className="bg-[#93000a]/30 text-[#ffb4ab] p-3 rounded-lg text-sm flex items-start gap-2 border border-[#93000a]/50">
                            <span className="material-icons-round text-lg">error_outline</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit} autoComplete="on">
                        {/* Input Group: Email */}
                        <div className="space-y-2">
                            <label className="font-label text-xs font-semibold text-gray-600 dark:text-[#bacac7] uppercase tracking-wider" htmlFor="email">Identificador Clínico</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-600 dark:text-[#bacac7] group-focus-within:text-[#4afdef] transition-colors">
                                    <span className="material-icons-round text-lg">alternate_email</span>
                                </div>
                                <input 
                                    className="w-full h-12 bg-gray-100 dark:bg-[#32353c] border-none rounded-lg pl-12 pr-4 text-[#e1e2eb] placeholder-[#3b4a48] focus:ring-2 focus:ring-[#4afdef]/50 focus:bg-gray-50 dark:bg-[#272a31] transition-all" 
                                    id="email" 
                                    name="email" 
                                    type="text"
                                    placeholder="usuario_medico"
                                    value={credentials.email}
                                    onChange={handleChange}
                                    autoComplete="username"
                                    required 
                                />
                            </div>
                        </div>

                        {/* Input Group: Password */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="font-label text-xs font-semibold text-gray-600 dark:text-[#bacac7] uppercase tracking-wider" htmlFor="password">Token de Acceso</label>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-600 dark:text-[#bacac7] group-focus-within:text-[#4afdef] transition-colors">
                                    <span className="material-icons-round text-lg">lock</span>
                                </div>
                                <input 
                                    className="w-full h-12 bg-gray-100 dark:bg-[#32353c] border-none rounded-lg pl-12 pr-4 text-[#e1e2eb] placeholder-[#3b4a48] focus:ring-2 focus:ring-[#4afdef]/50 focus:bg-gray-50 dark:bg-[#272a31] transition-all" 
                                    id="password" 
                                    name="password" 
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••••"
                                    value={credentials.password}
                                    onChange={handleChange}
                                    autoComplete="current-password"
                                    required 
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-600 dark:text-[#bacac7] hover:text-[#e1e2eb] transition-colors"
                                    tabIndex="-1"
                                >
                                    <span className="material-icons-round text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div>
                            <div className="flex items-center">
                                <div className="relative flex items-center h-5">
                                    <input 
                                        className="h-5 w-5 rounded border-[#3b4a48] bg-[#1d2026] text-[#4afdef] focus:ring-[#4afdef]/30 focus:ring-offset-[#10131a] cursor-pointer" 
                                        id="remember" 
                                        name="remember" 
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <label className="text-gray-600 dark:text-[#bacac7] cursor-pointer select-none" htmlFor="remember">Recordar mi usuario en esta PC</label>
                                </div>
                            </div>
                            <p className="mt-2 text-[11px] text-gray-600 dark:text-[#bacac7]">
                                No guardamos la contraseña en el sistema, solo el usuario para autocompletar.
                            </p>
                        </div>

                        {/* Sign In Button */}
                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-gradient-to-r from-[#4afdef] to-[#00e0d3] text-[#00201e] font-headline font-bold text-sm rounded-lg shadow-[0_4px_15px_rgba(0,224,211,0.2)] hover:shadow-[0_4px_25px_rgba(0,224,211,0.4)] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-[#00201e]/30 border-t-[#00201e] rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    INICIALIZAR PORTAL
                                    <span className="material-icons-round text-xl transition-transform group-hover:translate-x-1">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Secondary Actions */}
                    <div className="mt-8 pt-6 border-t border-[#3b4a48]/20 flex flex-col items-center gap-4">
                        <button 
                            type="button"
                            className="w-full h-11 border border-[#3b4a48]/30 hover:border-[#4afdef]/50 hover:bg-white/5 text-[#e1e2eb] font-label text-sm rounded-lg transition-all"
                        >
                            Registrar Nuevo Médico
                        </button>
                    </div>
                </div>

                {/* System Status Footer */}
                <div className="mt-8 flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#4afdef] animate-pulse shadow-[0_0_8px_#00e0d3]"></span>
                        <span className="text-[10px] font-label font-bold uppercase tracking-widest text-gray-600 dark:text-[#bacac7]">Core Engine Online</span>
                    </div>
                    <div className="w-[1px] h-3 bg-[#3b4a48]/30"></div>
                    <div className="flex items-center gap-2">
                        <span className="material-icons-round text-sm text-gray-600 dark:text-[#bacac7]">lock</span>
                        <span className="text-[10px] font-label font-bold uppercase tracking-widest text-gray-600 dark:text-[#bacac7]">256-bit AES</span>
                    </div>
                </div>
            </main>

            {/* Background Decorative Elements */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#4afdef]/5 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#104f4a]/10 blur-[150px] rounded-full"></div>
                {/* Subtle Grid Pattern */}
                <div 
                    className="absolute inset-0 opacity-[0.02]" 
                    style={{ backgroundImage: 'radial-gradient(#bacac7 1px, transparent 1px)', backgroundSize: '40px 40px' }}
                ></div>
            </div>
        </div>
    );
};

export default Login;
