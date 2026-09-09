import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, Eye, EyeOff, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('roopramandesign@gmail.com');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your work email.');
      return;
    }
    setError('');
    setLoading(true);

    // Dynamic professional validation delay
    setTimeout(async () => {
      try {
        await login(email, password);
      } catch (err) {
        setError('Verification failed. Check your network or credentials.');
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  const handleQuickFill = () => {
    setEmail('roopramandesign@gmail.com');
    setPassword('manager123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-white flex relative overflow-hidden">
      
      {/* LEFT SIDE: PREMIUM TEXTLESS SVG ABSTRACT SYSTEM ILLUSTRATION */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] bg-[#0f111a] relative items-center justify-center overflow-hidden p-16">
        {/* Geometric blueprints and organic mesh gradients background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e293b,transparent)] opacity-40"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,#0f172a,transparent)] opacity-80"></div>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0" style={{ 
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', 
          backgroundSize: '24px 24px' 
        }}></div>

        {/* Dynamic, clean math-inspired vector network illustration */}
        <svg className="w-full max-w-[420px] aspect-square relative z-10 opacity-80" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Subtle connecting lines */}
          <path d="M100 200 L200 100 L300 200 L200 300 Z" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M50 200 L350 200" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
          <path d="M200 50 L200 350" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
          
          {/* Outer Concentric Spheres/Rings representing process circulation */}
          <circle cx="200" cy="200" r="140" stroke="rgba(59, 130, 246, 0.15)" strokeWidth="1" />
          <circle cx="200" cy="200" r="100" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="60" stroke="rgba(59, 130, 246, 0.25)" strokeWidth="1" strokeDasharray="3 3" />
          
          {/* Floating node 1 - Top */}
          <circle cx="200" cy="100" r="24" fill="#1e293b" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="2" />
          <path d="M192 100 H208 M200 92 V108" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
          
          {/* Floating node 2 - Right */}
          <circle cx="300" cy="200" r="24" fill="#1e293b" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="2" />
          <circle cx="300" cy="200" r="8" fill="#3b82f6" />
          
          {/* Floating node 3 - Bottom */}
          <circle cx="200" cy="300" r="24" fill="#1e293b" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" />
          <path d="M194 300 L198 304 L206 296" stroke="#a3a3a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* Floating node 4 - Left */}
          <circle cx="100" cy="200" r="24" fill="#1e293b" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="2" />
          <circle cx="100" cy="200" r="6" fill="#60a5fa" />
          
          {/* Central Core Connection */}
          <circle cx="200" cy="200" r="32" fill="#0f172a" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          <circle cx="200" cy="200" r="16" fill="rgba(59, 130, 246, 0.2)" />
          <circle cx="200" cy="200" r="6" fill="#3b82f6" />
          
          {/* Orbiting particles */}
          <circle cx="130" cy="130" r="4" fill="#3b82f6" className="animate-pulse" />
          <circle cx="270" cy="270" r="4" fill="#60a5fa" />
          <circle cx="270" cy="130" r="5" fill="#a3a3a3" />
        </svg>

        {/* Ambient subtle background decorative lights */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* RIGHT SIDE: MINIMALIST, HIGH-CONTRAST SECURE LOGIN FORM */}
      <div className="w-full lg:w-[55%] xl:w-[50%] flex items-center justify-center p-8 sm:p-12 md:p-16 lg:p-20 bg-neutral-50/20">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          
          {/* Logo only on Mobile View */}
          <div className="lg:hidden flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              SP
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-neutral-900">SP CRM</span>
          </div>

          <div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-neutral-900">
              Sign in to workspace
            </h1>
            <p className="text-xs text-neutral-500 mt-1.5">
              Enter your work email and password credentials.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50/80 border border-red-100 rounded-xl flex items-start gap-2.5 text-xs text-red-600 animate-in fade-in">
              <ShieldAlert size={16} className="shrink-0 mt-0.5 text-red-500" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1">
              <label htmlFor="email" className="block text-xs font-bold text-neutral-600 ml-1">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Mail size={16} />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. roopramandesign@gmail.com"
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200/80 focus:border-neutral-900 rounded-xl text-sm transition-all focus:bg-white text-neutral-800 outline-none font-medium"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between ml-1">
                <label htmlFor="password" className="block text-xs font-bold text-neutral-600">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] font-bold text-neutral-400 hover:text-neutral-900 transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-neutral-50 border border-neutral-200/80 focus:border-neutral-900 rounded-xl text-sm transition-all focus:bg-white text-neutral-800 outline-none font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-6 py-3 bg-neutral-900 text-white hover:bg-black rounded-xl font-bold text-sm tracking-tight transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/5 relative overflow-hidden ${
                loading ? 'opacity-85 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Connecting to servers...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
