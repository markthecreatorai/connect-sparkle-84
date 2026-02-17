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
export const Profile = () => <PlaceholderPage title="Meu Perfil" />;

export const AdminDashboard = () => <PlaceholderPage title="Admin Dashboard" />;
export const AdminUsers = () => <PlaceholderPage title="Gerenciar Usuários" />;
export const AdminDeposits = () => <PlaceholderPage title="Gerenciar Depósitos" />;
export const AdminWithdrawals = () => <PlaceholderPage title="Gerenciar Saques" />;
export const AdminSettings = () => <PlaceholderPage title="Configurações da Plataforma" />;
export const AdminLogs = () => <PlaceholderPage title="Logs de Atividade" />;
