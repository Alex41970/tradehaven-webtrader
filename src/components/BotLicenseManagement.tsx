import React, { useState, useEffect } from "react";
import { Key, Plus, Copy, Calendar, User, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface License {
  id: string;
  license_key: string;
  is_active: boolean;
  expires_at: string | null;
  used_by_user_id: string | null;
  created_at: string;
  user_email?: string;
}

export const BotLicenseManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      
      // Ensure user is authenticated before fetching
      if (!user?.id) {
        console.error('No authenticated user found');
        toast({
          title: "Error",
          description: "Authentication required",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Fetching bot licenses for admin:', user.id);
      
      // Get licenses created by this admin only
      const { data: licenseData, error: licenseError } = await supabase
        .from('bot_licenses')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      if (licenseError) {
        console.error('Error fetching licenses:', licenseError);
        throw licenseError;
      }

      console.log('Found licenses for admin:', licenseData?.length || 0);

      // Then get user emails for licenses that are in use
      const licensesWithEmails = await Promise.all(
        (licenseData || []).map(async (license) => {
          if (license.used_by_user_id) {
            const { data: userProfile, error: profileError } = await supabase
              .from('user_profiles')
              .select('email')
              .eq('user_id', license.used_by_user_id)
              .single();
            
            if (profileError) {
              console.warn('Could not fetch user profile for license:', license.id, profileError);
            }
            
            return {
              ...license,
              user_email: userProfile?.email
            };
          }
          return license;
        })
      );

      setLicenses(licensesWithEmails);
    } catch (error) {
      console.error('Error fetching licenses:', error);
      toast({
        title: "Error",
        description: "Failed to load licenses. You may not have permission to view this data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateLicense = async () => {
    try {
      const expiresAt = expiryDate ? new Date(expiryDate).toISOString() : null;
      
      const { data, error } = await supabase.rpc('generate_bot_license', {
        _admin_id: user?.id,
        _expires_at: expiresAt,
      });

      if (error) throw error;

      toast({
        title: "License Created",
        description: `New license key generated: ${data}`,
      });

      setCreateModalOpen(false);
      setExpiryDate("");
      await fetchLicenses();
    } catch (error) {
      console.error('Error generating license:', error);
      toast({
        title: "Error",
        description: "Failed to generate license",
        variant: "destructive",
      });
    }
  };

  const toggleLicense = async (licenseId: string, isActive: boolean) => {
    try {
      if (isActive) {
        // If deactivating, use the enhanced function that disconnects users
        const { data, error } = await supabase.rpc('deactivate_and_disconnect_license', {
          _admin_id: user?.id,
          _license_id: licenseId,
        });

        if (error) throw error;

        const result = data as any;
        toast({
          title: "License Deactivated",
          description: result.message || "License deactivated successfully",
        });
      } else {
        // Simple activation
        const { error } = await supabase
          .from('bot_licenses')
          .update({ is_active: true })
          .eq('id', licenseId);

        if (error) throw error;

        toast({
          title: "License Activated",
          description: "License is now active and can be used",
        });
      }

      await fetchLicenses();
    } catch (error) {
      console.error('Error toggling license:', error);
      toast({
        title: "Error",
        description: "Failed to update license",
        variant: "destructive",
      });
    }
  };

  const copyLicenseKey = (licenseKey: string) => {
    navigator.clipboard.writeText(licenseKey);
    toast({
      title: "Copied",
      description: "License key copied to clipboard",
    });
  };

  const deleteLicense = async (license: License) => {
    try {
      // Allow deletion only of deactivated licenses, or active licenses not in use
      if (license.is_active && license.used_by_user_id) {
        toast({
          title: "Cannot Delete Active License",
          description: "Please deactivate this license first to disconnect users, then delete it",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('bot_licenses')
        .delete()
        .eq('id', license.id);

      if (error) throw error;

      toast({
        title: "License Deleted",
        description: "License has been permanently deleted",
      });

      await fetchLicenses();
    } catch (error) {
      console.error('Error deleting license:', error);
      toast({
        title: "Error",
        description: "Failed to delete license",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bot License Management</h2>
          <p className="text-muted-foreground">Create and manage trading bot licenses for your users</p>
        </div>
        
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate License
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate New License</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date (Optional)</Label>
                <Input
                  id="expiry"
                  type="datetime-local"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for permanent license
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCreateModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={generateLicense} className="flex-1">
                  Generate
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            License Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{licenses.length}</div>
              <div className="text-sm text-muted-foreground">Total Licenses</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{licenses.filter(l => l.is_active).length}</div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{licenses.filter(l => l.used_by_user_id).length}</div>
              <div className="text-sm text-muted-foreground">In Use</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{licenses.filter(l => l.expires_at && isExpired(l.expires_at)).length}</div>
              <div className="text-sm text-muted-foreground">Expired</div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((license) => (
                <TableRow key={license.id}>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        {license.license_key.substring(0, 20)}...
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLicenseKey(license.license_key)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {license.is_active ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                      {license.expires_at && isExpired(license.expires_at) && (
                        <Badge variant="destructive">
                          <Clock className="h-3 w-3 mr-1" />
                          Expired
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {license.used_by_user_id ? (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="text-sm">{license.user_email || 'Unknown'}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not in use</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {license.expires_at ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span className="text-sm">{formatDate(license.expires_at)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(license.created_at)}</TableCell>
                   <TableCell>
                     <div className="flex items-center gap-2">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => toggleLicense(license.id, license.is_active)}
                       >
                         {license.is_active ? 'Deactivate' : 'Activate'}
                       </Button>
                       
                       <AlertDialog>
                         <AlertDialogTrigger asChild>
                           <Button
                             variant="outline"
                             size="sm"
                             className="text-destructive hover:bg-destructive/10"
                             disabled={license.is_active && license.used_by_user_id !== null}
                           >
                             <Trash2 className="h-3 w-3" />
                           </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent>
                           <AlertDialogHeader>
                             <AlertDialogTitle>Delete License</AlertDialogTitle>
                             <AlertDialogDescription>
                               Are you sure you want to delete this license key?
                               <br />
                               <strong>License: {license.license_key.substring(0, 20)}...</strong>
                               <br />
                               This action cannot be undone.
                             </AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                             <AlertDialogCancel>Cancel</AlertDialogCancel>
                             <AlertDialogAction
                               onClick={() => deleteLicense(license)}
                               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                             >
                               Delete License
                             </AlertDialogAction>
                           </AlertDialogFooter>
                         </AlertDialogContent>
                       </AlertDialog>
                     </div>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {licenses.length === 0 && (
            <div className="text-center py-8">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No licenses created yet</p>
              <p className="text-sm text-muted-foreground">Click "Generate License" to create your first trading bot license</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};