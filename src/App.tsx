import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleBasedRoute from "@/components/RoleBasedRoute";

import { ActivityProvider } from "@/contexts/ActivityContext";
import { PriceProvider } from "@/contexts/PriceContext";
import { useActivityAwareConnectionManager } from "@/hooks/useActivityAwareConnectionManager";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { usePromoCodeFallback } from "@/hooks/usePromoCodeFallback";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
import NotFound from "./pages/NotFound";
const Terms = lazy(() => import("./pages/Terms"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Careers = lazy(() => import("./pages/Careers"));
const Press = lazy(() => import("./pages/Press"));
const Contact = lazy(() => import("./pages/Contact"));
const Support = lazy(() => import("./pages/Support"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const Regulatory = lazy(() => import("./pages/Regulatory"));
const Markets = lazy(() => import("./pages/Markets"));
const Education = lazy(() => import("./pages/Education"));
import { WebTrader } from "./components/WebTrader";
import { MobilePortfolio } from "./pages/MobilePortfolio";
import { MobileTradingHistory } from "./pages/MobileTradingHistory";
const PromoCodeAnalytics = lazy(() => import("./pages/PromoCodeAnalytics"));
import CookieConsentBanner from "./components/CookieConsentBanner";

const queryClient = new QueryClient();

// Connection manager component that must be inside ActivityProvider
const ConnectionManager = () => {
  useActivityAwareConnectionManager();
  useActivityTracker(); // Track user activity
  usePromoCodeFallback(); // Handle promo code fallback assignment
  return null;
};

const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <PriceProvider>
          <ActivityProvider>
            <ConnectionManager />
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
              <Suspense fallback={<div className="min-h-screen bg-background" />}>
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
          <Route path="/regulatory" element={<Regulatory />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/markets/:category" element={<Markets />} />
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
              </Suspense>
              <CookieConsentBanner />
            </BrowserRouter>
          </TooltipProvider>
          </ActivityProvider>
        </PriceProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;