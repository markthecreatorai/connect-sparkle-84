import { Construction } from "lucide-react";

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
    <div className="glass-card rounded-2xl p-8 text-center max-w-md">
      <Construction className="mx-auto h-12 w-12 text-primary mb-4" />
      <h1 className="font-heading text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground text-sm">Em construção</p>
    </div>
  </div>
);

// Dashboard, Deposit, Withdraw, Transactions, Team, Invite are now in their own files
// Admin pages are now in src/pages/admin/
export const Profile = () => <PlaceholderPage title="Meu Perfil" />;
