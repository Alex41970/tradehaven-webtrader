import React, { createContext, useContext, useEffect, useState } from 'react';
import { userActivityManager } from '@/services/UserActivityManager';

interface ActivityContextType {
  isUserActive: boolean;
  lastActivity: Date;
  minutesSinceLastActivity: number;
  forceActive: () => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const useActivity = () => {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
};

interface ActivityProviderProps {
  children: React.ReactNode;
}

export const ActivityProvider = ({ children }: ActivityProviderProps) => {
  const [isUserActive, setIsUserActive] = useState(true);
  const [lastActivity, setLastActivity] = useState(new Date());
  const [minutesSinceLastActivity, setMinutesSinceLastActivity] = useState(0);

  useEffect(() => {
    const unsubscribe = userActivityManager.subscribe((isActive, lastActivityTime) => {
      setIsUserActive(isActive);
      setLastActivity(lastActivityTime);
      
      const minutesSince = Math.floor((Date.now() - lastActivityTime.getTime()) / (1000 * 60));
      setMinutesSinceLastActivity(minutesSince);

      console.log(`🎯 Activity state changed: ${isActive ? 'ACTIVE' : 'INACTIVE'} (${minutesSince}m ago)`);
    });

    // Update minutes counter every minute
    const minuteInterval = setInterval(() => {
      const state = userActivityManager.getState();
      setMinutesSinceLastActivity(state.minutesSinceLastActivity);
    }, 60000);

    return () => {
      unsubscribe();
      clearInterval(minuteInterval);
    };
  }, []);

  const forceActive = () => {
    userActivityManager.forceActive();
  };

  return (
    <ActivityContext.Provider value={{
      isUserActive,
      lastActivity,
      minutesSinceLastActivity,
      forceActive
    }}>
      {children}
    </ActivityContext.Provider>
  );
};