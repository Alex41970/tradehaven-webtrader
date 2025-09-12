import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TradingHistory } from "@/components/TradingHistory";
import { useIsMobile } from "@/hooks/use-mobile";

export const MobileTradingHistory = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Redirect desktop users to main WebTrader
  React.useEffect(() => {
    if (!isMobile) {
      navigate("/webtrader");
    }
  }, [isMobile, navigate]);

  if (!isMobile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Mobile Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/webtrader")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to WebTrader
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