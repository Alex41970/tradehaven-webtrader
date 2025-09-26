import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Activity, Pause, Clock } from 'lucide-react';
import { useActivity } from '@/contexts/ActivityContext';

export const ActivityStatusIndicator: React.FC = () => {
  const { isUserActive, minutesSinceLastActivity, forceActive } = useActivity();

  const handleClick = () => {
    if (!isUserActive) {
      forceActive();
    }
  };

  if (isUserActive) {
    return (
      <Badge 
        variant="default" 
        className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700"
      >
        <Activity className="h-3 w-3" />
        Active
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className="flex items-center gap-1 text-xs cursor-pointer hover:bg-muted/50 transition-colors border-orange-500 text-orange-500"
      onClick={handleClick}
      title="Click to resume activity"
    >
      <Pause className="h-3 w-3" />
      Inactive ({minutesSinceLastActivity}m)
    </Badge>
  );
};