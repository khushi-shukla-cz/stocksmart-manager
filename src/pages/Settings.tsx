import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

const Settings = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Configure your system preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <SettingsIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Settings panel coming soon</p>
              <p className="text-sm mt-1">Configure warehouses, categories, and user roles</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;