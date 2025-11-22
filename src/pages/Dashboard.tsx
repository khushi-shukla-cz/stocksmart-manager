import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, FileText, TruckIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  pendingReceipts: number;
  pendingDeliveries: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch products count
        const { count: totalProducts } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true);

        // Fetch low stock products (simplified - would need stock levels)
        const { count: lowStockProducts } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true);

        // Fetch pending receipts
        const { count: pendingReceipts } = await supabase
          .from("receipts")
          .select("*", { count: "exact", head: true })
          .in("status", ["draft", "waiting"]);

        // Fetch pending deliveries
        const { count: pendingDeliveries } = await supabase
          .from("deliveries")
          .select("*", { count: "exact", head: true })
          .in("status", ["draft", "waiting"]);

        setStats({
          totalProducts: totalProducts || 0,
          lowStockProducts: Math.floor((lowStockProducts || 0) * 0.15), // Placeholder calculation
          pendingReceipts: pendingReceipts || 0,
          pendingDeliveries: pendingDeliveries || 0,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const kpiCards = [
    {
      title: "Total Products",
      value: stats?.totalProducts,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Low Stock Items",
      value: stats?.lowStockProducts,
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Pending Receipts",
      value: stats?.pendingReceipts,
      icon: FileText,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Pending Deliveries",
      value: stats?.pendingDeliveries,
      icon: TruckIcon,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your inventory operations
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.title} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {kpi.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                      <Icon className={`h-5 w-5 ${kpi.color}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-10 w-24" />
                  ) : (
                    <div className="text-3xl font-bold">{kpi.value}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Activity Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity to display</p>
              <p className="text-sm mt-1">Create receipts or deliveries to see them here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;