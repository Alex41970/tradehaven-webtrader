import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface UserProfile {
  user_id: string;
  email: string;
  first_name?: string;
  surname?: string;
  phone_number?: string;
  balance: number;
}

interface UserSearchSelectProps {
  users: UserProfile[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  label?: string;
  placeholder?: string;
  showBalance?: boolean;
}

export const UserSearchSelect = ({ 
  users, 
  selectedUserId, 
  onSelectUser,
  label = "Select User",
  placeholder = "Search by name, email, or phone...",
  showBalance = false
}: UserSearchSelectProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(user => {
      const name = `${user.first_name || ''} ${user.surname || ''}`.toLowerCase();
      const email = user.email?.toLowerCase() || '';
      const phone = user.phone_number?.toLowerCase() || '';
      
      return name.includes(query) || 
             email.includes(query) || 
             phone.includes(query);
    });
  }, [users, searchQuery]);

  const selectedUser = users.find(u => u.user_id === selectedUserId);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      
      <div className="relative mb-2">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Select value={selectedUserId} onValueChange={onSelectUser}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a user">
            {selectedUser && (
              <span>
                {selectedUser.first_name && selectedUser.surname 
                  ? `${selectedUser.first_name} ${selectedUser.surname}` 
                  : selectedUser.email}
                {showBalance && ` - $${selectedUser.balance?.toFixed(2) || '0.00'}`}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {filteredUsers.length === 0 ? (
            <div className="p-2 text-sm text-muted-foreground text-center">
              No users found
            </div>
          ) : (
            filteredUsers.map((user) => (
              <SelectItem key={user.user_id} value={user.user_id}>
                {user.first_name && user.surname 
                  ? `${user.first_name} ${user.surname} (${user.email})` 
                  : user.email}
                {showBalance && ` - $${user.balance?.toFixed(2) || '0.00'}`}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      
      {searchQuery && filteredUsers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      )}
    </div>
  );
};
