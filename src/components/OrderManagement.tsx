import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Target, X, CheckCircle } from 'lucide-react';
import { useTradeOrders } from '@/hooks/useTradeOrders';
import { formatPnL } from '@/utils/numberFormatter';

export const OrderManagement: React.FC = () => {
  const { orders, loading, cancelOrder, pendingOrders, filledOrders } = useTradeOrders();

  const getOrderTypeIcon = (orderType: string) => {
    switch (orderType) {
      case 'limit':
        return <Target className="h-4 w-4" />;
      case 'stop':
        return <Clock className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getOrderTypeColor = (orderType: string) => {
    switch (orderType) {
      case 'limit':
        return 'text-trading-accent';
      case 'stop':
        return 'text-trading-danger';
      default:
        return 'text-trading-success';
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      filled: "default",
      cancelled: "destructive",
      expired: "outline",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="text-xs">
        {status.toUpperCase()}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-trading-secondary/20">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-trading-secondary/20 rounded"></div>
            <div className="h-4 bg-trading-secondary/20 rounded w-3/4"></div>
            <div className="h-4 bg-trading-secondary/20 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-trading-secondary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-trading-accent" />
          Order Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              Pending ({pendingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              History ({filledOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending orders</p>
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 bg-trading-secondary/10 rounded-lg border border-trading-secondary/20"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={getOrderTypeColor(order.order_type)}>
                        {getOrderTypeIcon(order.order_type)}
                      </div>
                      <span className="font-medium">{order.symbol}</span>
                      <Badge variant={order.trade_type === 'BUY' ? 'default' : 'secondary'}>
                        {order.trade_type}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelOrder(order.id)}
                      className="text-trading-danger hover:text-trading-danger hover:bg-trading-danger/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Amount</div>
                      <div className="font-medium">{order.amount}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Leverage</div>
                      <div className="font-medium">{order.leverage}x</div>
                    </div>
                    {order.trigger_price && (
                      <div>
                        <div className="text-muted-foreground">
                          {order.order_type === 'limit' ? 'Limit Price' : 'Stop Price'}
                        </div>
                        <div className="font-medium">${order.trigger_price.toFixed(5)}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-muted-foreground">Created</div>
                      <div className="font-medium">{formatDate(order.created_at)}</div>
                    </div>
                  </div>

                  {(order.stop_loss_price || order.take_profit_price) && (
                    <div className="mt-3 pt-3 border-t border-trading-secondary/20">
                      <div className="text-xs text-muted-foreground mb-2">Risk Management</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {order.stop_loss_price && (
                          <div>
                            <div className="text-muted-foreground">Stop Loss</div>
                            <div className="font-medium text-trading-danger">
                              ${order.stop_loss_price.toFixed(5)}
                            </div>
                          </div>
                        )}
                        {order.take_profit_price && (
                          <div>
                            <div className="text-muted-foreground">Take Profit</div>
                            <div className="font-medium text-trading-success">
                              ${order.take_profit_price.toFixed(5)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {order.expires_at && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Expires: {formatDate(order.expires_at)}
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {filledOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No order history</p>
              </div>
            ) : (
              filledOrders.slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  className="p-4 bg-trading-secondary/5 rounded-lg border border-trading-secondary/10"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="text-trading-success">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <span className="font-medium">{order.symbol}</span>
                      <Badge variant={order.trade_type === 'BUY' ? 'default' : 'secondary'}>
                        {order.trade_type}
                      </Badge>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Amount</div>
                      <div className="font-medium">{order.amount}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Leverage</div>
                      <div className="font-medium">{order.leverage}x</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Filled</div>
                      <div className="font-medium">
                        {order.filled_at ? formatDate(order.filled_at) : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};