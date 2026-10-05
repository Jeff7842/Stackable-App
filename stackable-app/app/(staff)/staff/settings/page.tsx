import TwoFactorSetup from "@/components/auth/TwoFactorSetup";

export default function StaffSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <TwoFactorSetup />
    </div>
  );
}
