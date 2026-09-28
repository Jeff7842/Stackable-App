import TwoFactorSetup from "@/components/auth/TwoFactorSetup";

export default function settings() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <TwoFactorSetup />
        </div>
    );
}
