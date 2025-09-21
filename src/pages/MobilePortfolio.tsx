import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Portfolio } from "@/components/Portfolio";
import { useIsMobile } from "@/hooks/use-mobile";

export const MobilePortfolio = () => {
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
        <h1 className="text-xl font-semibold">Portfolio</h1>
        <div></div> {/* Spacer for center alignment */}
      </div>

      {/* Portfolio Component */}
      <Portfolio />
    </div>
  );
};

export default MobilePortfolio;