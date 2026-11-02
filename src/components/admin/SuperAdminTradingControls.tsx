import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminTradingSettings } from "@/components/AdminTradingSettings";

interface Props {
  admins: { user_id: string; email: string }[];
}

/** Super admin picks which admin's traders the market controls apply to. */
export default function SuperAdminTradingControls({ admins }: Props) {
  const [adminId, setAdminId] = useState<string>("");

  useEffect(() => {
    if (!adminId && admins.length > 0) setAdminId(admins[0].user_id);
  }, [admins, adminId]);

  if (admins.length === 0) {
    return <p className="text-sm text-muted-foreground">No admins yet. Create an admin first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 max-w-sm">
        <Label>Apply to traders of admin</Label>
        <Select value={adminId} onValueChange={setAdminId}>
          <SelectTrigger><SelectValue placeholder="Choose admin" /></SelectTrigger>
          <SelectContent>
            {admins.map((a) => (
              <SelectItem key={a.user_id} value={a.user_id}>{a.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {adminId && <AdminTradingSettings key={adminId} mode="controls" adminId={adminId} />}
    </div>
  );
}
