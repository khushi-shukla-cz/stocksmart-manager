import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, FileText } from "lucide-react";
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

interface Receipt {
  id: string;
  reference: string;
  supplier_name: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
}

interface Warehouse {
  id: string;
  name: string;
}

const Receipts = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    supplier_name: "",
    warehouse_id: "",
    scheduled_date: "",
  });

  useEffect(() => {
    fetchReceipts();
    fetchWarehouses();
  }, []);

  const fetchReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      toast.error("Failed to load receipts");
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
      // Generate reference number
      const reference = `RCP-${Date.now()}`;

      const { error } = await supabase.from("receipts").insert([
        {
          reference,
          supplier_name: formData.supplier_name,
          warehouse_id: formData.warehouse_id,
          scheduled_date: formData.scheduled_date || null,
          status: "draft",
        },
      ]);

      if (error) throw error;

      toast.success("Receipt created successfully");
      setDialogOpen(false);
      setFormData({
        supplier_name: "",
        warehouse_id: "",
        scheduled_date: "",
      });
      fetchReceipts();
    } catch (error: any) {
      toast.error(error.message || "Failed to create receipt");
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
            <h1 className="text-4xl font-bold mb-2">Receipts</h1>
            <p className="text-muted-foreground">
              Track incoming stock from suppliers
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Receipt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Receipt</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier Name *</Label>
                  <Input
                    id="supplier"
                    value={formData.supplier_name}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier_name: e.target.value })
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
                    Create Receipt
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Receipts List */}
        {receipts.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No receipts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first receipt to track incoming stock
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <Card key={receipt.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{receipt.reference}</h3>
                      <Badge className={getStatusColor(receipt.status)}>
                        {receipt.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Supplier: {receipt.supplier_name}
                    </p>
                    {receipt.scheduled_date && (
                      <p className="text-xs text-muted-foreground">
                        Scheduled: {new Date(receipt.scheduled_date).toLocaleDateString()}
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

export default Receipts;