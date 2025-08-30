import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useFixUserBalance = () => {
  const [isFixing, setIsFixing] = useState(false);
  const { toast } = useToast();

  const fixUserBalance = async (userId?: string) => {
    setIsFixing(true);
    try {
      console.log('🔧 Attempting to fix user balance for:', userId);
      
      const { data, error } = await supabase.rpc('auto_recalculate_user_margins', {
        _user_id: userId
      });

      if (error) {
        console.error('❌ Error fixing balance:', error);
        toast({
          title: "Balance Fix Failed",
          description: error.message,
          variant: "destructive"
        });
        return false;
      }

      console.log('✅ Balance fixed successfully:', data);
      toast({
        title: "Balance Fixed",
        description: "Your balance has been recalculated correctly",
        variant: "default"
      });
      
      return true;
    } catch (error) {
      console.error('❌ Unexpected error fixing balance:', error);
      toast({
        title: "Balance Fix Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsFixing(false);
    }
  };

  return {
    fixUserBalance,
    isFixing
  };
};