import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, ShieldAlert, Users, CreditCard, Zap, Ban, CheckCircle, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ targetUserId, updates }: { targetUserId: string, updates: any }) => {
      const res = await apiRequest("POST", "/api/admin/update-user", { targetUserId, updates });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User updated successfully.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <Skeleton className="h-[400px] w-full bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-50">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3">
            <Shield className="text-emerald-500" />
            SaaS Ops Console
          </h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">Admin Management & Subscription Control</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-emerald-500/20 text-emerald-500 bg-emerald-500/5 px-3 py-1">
            System Online
          </Badge>
        </div>
      </div>

      <Card className="bg-[#0b1120] border-slate-800 overflow-hidden">
        <CardHeader className="border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold uppercase tracking-tight">User Directory</CardTitle>
              <CardDescription className="text-xs text-slate-500">Manage user roles, subscriptions, and account status</CardDescription>
            </div>
            <Users size={20} className="text-slate-700" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-900/30">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">User ID</TableHead>
                <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Role</TableHead>
                <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Plan</TableHead>
                <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">MT5 Token</TableHead>
                <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Registered</TableHead>
                <TableHead className="text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id} className="border-slate-800 hover:bg-slate-900/40 transition-colors">
                  <TableCell className="font-mono text-xs text-slate-400">{user.userId}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[10px] uppercase font-bold px-2 py-0",
                      user.role === "OWNER" ? "border-rose-500/50 text-rose-500 bg-rose-500/5" : "border-slate-700 text-slate-500"
                    )}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "text-[10px] uppercase font-bold px-2 py-0",
                      user.subscriptionTier === "PRO" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                    )}>
                      {user.subscriptionTier}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-slate-600">
                    {user.syncToken ? `${user.syncToken.slice(0, 8)}...` : "None"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "N/A"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {user.subscriptionTier === "FREE" ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-[10px] border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                        onClick={() => updateMutation.mutate({ targetUserId: user.userId, updates: { subscriptionTier: "PRO" } })}
                      >
                        <Zap size={10} className="mr-1" />
                        Grant PRO
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-[10px] border-slate-700 text-slate-400 hover:bg-slate-800"
                        onClick={() => updateMutation.mutate({ targetUserId: user.userId, updates: { subscriptionTier: "FREE" } })}
                      >
                        <Clock size={10} className="mr-1" />
                        Set FREE
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0 text-slate-600 hover:text-rose-500 hover:bg-rose-500/5"
                    >
                      <Ban size={12} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#0b1120] border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <CreditCard size={14} />
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white">
              {users?.filter(u => u.subscriptionTier === "PRO").length || 0}
            </div>
            <p className="text-[10px] text-slate-600 uppercase mt-1">Paying PRO Customers</p>
          </CardContent>
        </Card>
        
        <Card className="bg-[#0b1120] border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Users size={14} />
              Total Registrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white">{users?.length || 0}</div>
            <p className="text-[10px] text-slate-600 uppercase mt-1">Users in Database</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0b1120] border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <ShieldAlert size={14} />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-emerald-500 uppercase flex items-center gap-2">
              <CheckCircle size={18} />
              Operational
            </div>
            <p className="text-[10px] text-slate-600 uppercase mt-1">All services active</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
