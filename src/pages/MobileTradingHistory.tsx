import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TradingHistory } from "@/components/TradingHistory";
import { useIsMobile } from "@/hooks/use-mobile";

export const MobileTradingHistory = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Mobile Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-xl font-semibold">Trading History</h1>
        <div></div> {/* Spacer for center alignment */}
      </div>

      {/* Trading History Component */}
      <TradingHistory />
    </div>
  );
};

export default MobileTradingHistory;