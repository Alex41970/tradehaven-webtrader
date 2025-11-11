import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleBasedRoute from "@/components/RoleBasedRoute";

import { ActivityProvider } from "@/contexts/ActivityContext";
import { useActivityAwareConnectionManager } from "@/hooks/useActivityAwareConnectionManager";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { usePromoCodeFallback } from "@/hooks/usePromoCodeFallback";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import AboutUs from "./pages/AboutUs";
import Careers from "./pages/Careers";
import Press from "./pages/Press";
import Contact from "./pages/Contact";
import Support from "./pages/Support";
import CookiePolicy from "./pages/CookiePolicy";
import RiskDisclosure from "./pages/RiskDisclosure";
import Regulatory from "./pages/Regulatory";
import Markets from "./pages/Markets";
import Education from "./pages/Education";
import { WebTrader } from "./components/WebTrader";
import { MobilePortfolio } from "./pages/MobilePortfolio";
import { MobileTradingHistory } from "./pages/MobileTradingHistory";
import PromoCodeAnalytics from "./pages/PromoCodeAnalytics";

const queryClient = new QueryClient();

// Connection manager component that must be inside ActivityProvider
const ConnectionManager = () => {
  useActivityAwareConnectionManager();
  useActivityTracker(); // Track user activity
  usePromoCodeFallback(); // Handle promo code fallback assignment
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <ActivityProvider>
          
            <ConnectionManager />
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/press" element={<Press />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/support" element={<Support />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/risk-disclosure" element={<RiskDisclosure />} />
          <Route path="/regulatory" element={<Regulatory />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/education" element={<Education />} />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
                    <AdminDashboard />
                  </RoleBasedRoute>
                } />
                <Route path="/super-admin" element={
                  <RoleBasedRoute allowedRoles={['super_admin']}>
                    <SuperAdminDashboard />
                  </RoleBasedRoute>
                } />
                <Route path="/admin/promo-analytics" element={
                  <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
                    <PromoCodeAnalytics />
                  </RoleBasedRoute>
                } />
                <Route path="/webtrader" element={
                  <ProtectedRoute>
                    <WebTrader />
                  </ProtectedRoute>
                } />
                <Route path="/webtrader/portfolio" element={
                  <ProtectedRoute>
                    <MobilePortfolio />
                  </ProtectedRoute>
                } />
                <Route path="/webtrader/trading-history" element={
                  <ProtectedRoute>
                    <MobileTradingHistory />
                  </ProtectedRoute>
                } />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        
      </ActivityProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
