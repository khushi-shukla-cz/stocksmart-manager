import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, TruckIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Delivery {
  id: string;
  reference: string;
  customer_name: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
}

interface Warehouse {
  id: string;
  name: string;
}

const Deliveries = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: "",
    warehouse_id: "",
    scheduled_date: "",
  });

  useEffect(() => {
    fetchDeliveries();
    fetchWarehouses();
  }, []);

  const fetchDeliveries = async () => {
    try {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeliveries(data || []);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      toast.error("Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const reference = `DEL-${Date.now()}`;

      const { error } = await supabase.from("deliveries").insert([
        {
          reference,
          customer_name: formData.customer_name,
          warehouse_id: formData.warehouse_id,
          scheduled_date: formData.scheduled_date || null,
          status: "draft",
        },
      ]);

      if (error) throw error;

      toast.success("Delivery created successfully");
      setDialogOpen(false);
      setFormData({
        customer_name: "",
        warehouse_id: "",
        scheduled_date: "",
      });
      fetchDeliveries();
    } catch (error: any) {
      toast.error(error.message || "Failed to create delivery");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      waiting: "bg-warning/20 text-warning",
      ready: "bg-accent/20 text-accent",
      done: "bg-success/20 text-success",
      canceled: "bg-destructive/20 text-destructive",
    };
    return colors[status] || colors.draft;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Deliveries</h1>
            <p className="text-muted-foreground">
              Manage outgoing shipments to customers
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Delivery
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Delivery</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer Name *</Label>
                  <Input
                    id="customer"
                    value={formData.customer_name}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warehouse">Warehouse *</Label>
                  <Select
                    value={formData.warehouse_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, warehouse_id: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Scheduled Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) =>
                      setFormData({ ...formData, scheduled_date: e.target.value })
                    }
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    Create Delivery
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Deliveries List */}
        {deliveries.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <TruckIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No deliveries yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first delivery to track outgoing shipments
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {deliveries.map((delivery) => (
              <Card key={delivery.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{delivery.reference}</h3>
                      <Badge className={getStatusColor(delivery.status)}>
                        {delivery.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Customer: {delivery.customer_name}
                    </p>
                    {delivery.scheduled_date && (
                      <p className="text-xs text-muted-foreground">
                        Scheduled: {new Date(delivery.scheduled_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button variant="outline">View Details</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Deliveries;