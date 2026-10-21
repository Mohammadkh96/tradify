import React from 'react';
import { Button } from '../../components/ui/Button';

export const AdminUsers = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Users</h2>
          <p className="text-sm text-muted-foreground">Manage platform users, roles, and statuses.</p>
        </div>
        <Button>Export CSV</Button>
      </div>

      {/* Filters Architecture */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
            <input 
              type="text" 
              placeholder="Email, Name, or ID" 
              className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
            <select className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option>All Roles</option>
              <option>TRADER</option>
              <option>COACH</option>
              <option>MODERATOR</option>
              <option>ADMIN</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <select className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option>All Statuses</option>
              <option>ACTIVE</option>
              <option>SUSPENDED</option>
              <option>BANNED</option>
            </select>
          </div>
          <div className="flex items-end">
             <Button variant="outline" className="w-full h-9">Apply Filters</Button>
          </div>
        </div>
      </div>

      {/* Table Architecture */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Country</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Empty state since API is not implemented */}
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  User list API not yet implemented.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
