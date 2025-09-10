import React, { useState } from 'react';
import { PremiumCard, PremiumCardContent, PremiumCardHeader } from '@/components/PremiumCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { formatLargeNumber } from '@/utils/numberFormatter';
import { TransactionHistory } from '@/hooks/useTransactionHistory';

interface ModernTransactionHistoryProps {
  transactions: TransactionHistory[];
  onTransactionClick?: (transaction: TransactionHistory) => void;
  loading?: boolean;
}

export const ModernTransactionHistory: React.FC<ModernTransactionHistoryProps> = ({
  transactions,
  onTransactionClick,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'trade'>('all');

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.amount.toString().includes(searchTerm);
    const matchesFilter = filter === 'all' || transaction.type === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-trading-success" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-accent animate-pulse" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-trading-danger" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="w-4 h-4 text-trading-success" />;
      case 'withdrawal':
        return <ArrowUpRight className="w-4 h-4 text-trading-danger" />;
      case 'trade':
        return <TrendingUp className="w-4 h-4 text-primary" />;
      default:
        return <ExternalLink className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <PremiumCard glassmorphism className="min-h-[400px]">
        <PremiumCardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-3 bg-muted/60 rounded w-1/2"></div>
                </div>
                <div className="h-6 bg-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        </PremiumCardContent>
      </PremiumCard>
    );
  }

  return (
    <PremiumCard glassmorphism glow>
      <PremiumCardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold font-playfair text-foreground">Transaction History</h3>
            <p className="text-sm text-muted-foreground">Recent account activity and transactions</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            <div className="flex rounded-lg border border-border overflow-hidden">
              {['all', 'deposit', 'withdrawal', 'trade'].map((filterOption) => (
                <Button
                  key={filterOption}
                  variant={filter === filterOption ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(filterOption as any)}
                  className="rounded-none capitalize"
                >
                  {filterOption}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PremiumCardHeader>
      
      <PremiumCardContent className="p-0">
        <div className="max-h-96 overflow-y-auto">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-muted-foreground" />
              </div>
              <h4 className="text-lg font-semibold mb-2">No transactions found</h4>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try adjusting your search terms' : 'Your transaction history will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  onClick={() => onTransactionClick?.(transaction)}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer transition-colors duration-200 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                      {getTypeIcon(transaction.type)}
                    </div>
                    
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground capitalize">
                          {transaction.type}
                        </span>
                        {getStatusIcon(transaction.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleDateString()} • 
                        {new Date(transaction.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`font-semibold ${
                        transaction.type === 'deposit' 
                          ? 'text-trading-success' 
                          : transaction.type === 'withdrawal'
                          ? 'text-trading-danger'
                          : 'text-foreground'
                      }`}>
                        {transaction.type === 'deposit' ? '+' : transaction.type === 'withdrawal' ? '-' : ''}
                        ${formatLargeNumber(Math.abs(transaction.amount)).display}
                      </div>
                      
                      <Badge 
                        variant="outline"
                        className={`text-xs ${
                          transaction.status === 'approved'
                            ? 'text-trading-success border-trading-success/20 bg-trading-success/5'
                            : transaction.status === 'pending'
                            ? 'text-accent border-accent/20 bg-accent/5'
                            : 'text-trading-danger border-trading-danger/20 bg-trading-danger/5'
                        }`}
                      >
                        {transaction.status}
                      </Badge>
                    </div>
                    
                    <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PremiumCardContent>
    </PremiumCard>
  );
};