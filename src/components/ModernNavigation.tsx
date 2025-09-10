import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Settings, 
  Calendar,
  ChevronDown,
  Activity
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type NavigationTab = 'dashboard' | 'reports' | 'portfolio' | 'analytics' | 'settings';

interface ModernNavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  timePeriod: string;
  onTimePeriodChange: (period: string) => void;
  className?: string;
}

export const ModernNavigation: React.FC<ModernNavigationProps> = ({
  activeTab,
  onTabChange,
  timePeriod,
  onTimePeriodChange,
  className
}) => {
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
    { id: 'reports' as const, label: 'Reports', icon: PieChart },
    { id: 'portfolio' as const, label: 'Portfolio', icon: TrendingUp },
    { id: 'analytics' as const, label: 'Analytics', icon: Activity },
    { id: 'settings' as const, label: 'Settings', icon: Settings }
  ];

  const timeOptions = [
    { value: 'January 2024 - May 2024', label: 'January 2024 - May 2024' },
    { value: 'Last 30 Days', label: 'Last 30 Days' },
    { value: 'Last 7 Days', label: 'Last 7 Days' },
    { value: 'This Month', label: 'This Month' },
    { value: 'All Time', label: 'All Time' }
  ];

  return (
    <div className={cn("flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-6 bg-card border-b border-border", className)}>
      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 h-10 font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs bg-primary-foreground/20 text-primary-foreground">
                  Active
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Time Period Selector */}
      <div className="flex items-center gap-4">
        <Popover open={isTimePickerOpen} onOpenChange={setIsTimePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="flex items-center gap-2 min-w-[200px] justify-between bg-card hover:bg-muted"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">{timePeriod}</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            <div className="space-y-1">
              {timeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => {
                    onTimePeriodChange(option.value);
                    setIsTimePickerOpen(false);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};