import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ConfirmProvider } from '@/components/ui/confirm';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { TelaInicial } from '@/components/layout/TelaInicial';
import { DialogsProvider } from '@/features/DialogsProvider';
import { AppShell } from '@/components/layout/AppShell';
import { configuracaoCompleta } from '@/lib/firebase';
import { podeFazer, type Capacidade } from '@/lib/permissions';
import Login from '@/pages/Login';
import PrimeiroAcesso from '@/pages/PrimeiroAcesso';
import Dashboard from '@/pages/Dashboard';
import Inicio from '@/pages/Inicio';
import RegistroForm from '@/pages/RegistroForm';
import Troca from '@/pages/Troca';
import Saida from '@/pages/Saida';
import ConfiguracaoInicial from '@/pages/ConfiguracaoInicial';
import Ativos from '@/pages/Ativos';
import Nutricao from '@/pages/Nutricao';

import { Bloqueios, Configuracoes, Diagnostico, Historico, Logs, Privacidade, Relatorios, Usuarios } from '@/lib/paginas';

function Protegida({ cap, children }: { cap: Capacidade; children: React.ReactNode }) {
  const { perfil } = useAuth();
  return podeFazer(perfil?.cargo, cap) ? <>{children}</> : <Navigate to="/" replace />;
}

function Raiz() {
  const { estado, perfil } = useAuth();
  if (estado === 'carregando') return <TelaInicial />;
  if (estado === 'configuracao') return <ConfiguracaoInicial />;
  if (estado === 'deslogado' || !perfil) return <Login />;
  if (perfil.primeiroAcesso) return <PrimeiroAcesso />;
  return (
    <DataProvider>
      <DialogsProvider>
        <Routes>
            <Route element={<AppShell />}>
              <Route index element={perfil.cargo === 'Nutrição' ? <Navigate to="/nutricao" replace /> : <Inicio />} />
              <Route path="painel" element={<Protegida cap="registrar"><Dashboard /></Protegida>} />
              <Route path="entrada" element={<Protegida cap="registrar"><RegistroForm tipo="acompanhante" /></Protegida>} />
              <Route path="visita" element={<Protegida cap="registrar"><RegistroForm tipo="visita" /></Protegida>} />
              <Route path="troca" element={<Protegida cap="registrar"><Troca /></Protegida>} />
              <Route path="saida" element={<Protegida cap="registrar"><Saida /></Protegida>} />
              <Route path="ativos" element={<Protegida cap="registrar"><Ativos /></Protegida>} />
              <Route path="nutricao" element={<Nutricao />} />
              <Route path="historico" element={<Protegida cap="registrar"><Historico /></Protegida>} />
              <Route path="bloqueios" element={<Protegida cap="bloqueios"><Bloqueios /></Protegida>} />
              <Route path="relatorios" element={<Protegida cap="relatorios"><Relatorios /></Protegida>} />
              <Route path="usuarios" element={<Protegida cap="usuarios"><Usuarios /></Protegida>} />
              <Route path="logs" element={<Protegida cap="logs"><Logs /></Protegida>} />
              <Route path="diagnostico" element={<Protegida cap="diagnostico"><Diagnostico /></Protegida>} />
              <Route path="configuracoes" element={<Protegida cap="config"><Configuracoes /></Protegida>} />
              <Route path="privacidade" element={<Privacidade />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
      </DialogsProvider>
    </DataProvider>
  );
}

function ConfigAusente() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-lg rounded-xl border bg-card p-8 shadow-pop">
        <AlertTriangle className="mb-3 h-8 w-8 text-warning" />
        <h1 className="text-lg font-bold">Configuração do Firebase ausente</h1>
        <p className="mt-2 text-sm text-muted-foreground">Copie <code className="rounded bg-muted px-1">.env.example</code> para <code className="rounded bg-muted px-1">.env.local</code>, preencha as variáveis <code>VITE_FIREBASE_*</code> e reinicie o servidor. Veja o README.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ConfirmProvider>
          {configuracaoCompleta ? (
            <AuthProvider><BrowserRouter><Raiz /></BrowserRouter></AuthProvider>
          ) : <ConfigAusente />}
          <Toaster />
        </ConfirmProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
