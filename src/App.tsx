import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import GeradorAditivo from "./pages/GeradorAditivo.tsx";
import Quitacao from "./pages/Quitacao.tsx";
import Configuracoes from "./pages/Configuracoes.tsx";
import ConfiguracoesQuitacao from "./pages/ConfiguracoesQuitacao.tsx";
import QuitacaoHistorico from "./pages/QuitacaoHistorico.tsx";
import AditivoHistorico from "./pages/AditivoHistorico.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gerador-aditivo"
              element={
                <ProtectedRoute>
                  <GeradorAditivo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quitacao"
              element={
                <ProtectedRoute>
                  <Quitacao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute>
                  <Configuracoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes/quitacao"
              element={
                <ProtectedRoute>
                  <ConfiguracoesQuitacao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quitacao/historico"
              element={
                <ProtectedRoute>
                  <QuitacaoHistorico />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gerador-aditivo/historico"
              element={
                <ProtectedRoute>
                  <AditivoHistorico />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
