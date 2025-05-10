import React from 'react';
import { Mail, MessageSquare, Volume2, Users } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

const Dashboard: React.FC = () => {
  const [stats, setStats] = React.useState({
    totalUsers: 0,
    activeEmails: 0,
    whatsappUsers: 0,
    audioEnabled: 0
  });
  const supabase = useSupabaseClient();

  React.useEffect(() => {
    const loadStats = async () => {
      try {
        // Charger les statistiques depuis Supabase
        const [
          { count: emailCount },
          { count: whatsappCount },
          { count: audioCount }
        ] = await Promise.all([
          supabase.from('email_credentials').select('*', { count: 'exact' }),
          supabase.from('user_whatsapp').select('*', { count: 'exact' }),
          supabase.from('user_settings').select('*', { count: 'exact', filter: 'audio_enabled.eq.true' })
        ]);

        setStats({
          totalUsers: whatsappCount || 0,
          activeEmails: emailCount || 0,
          whatsappUsers: whatsappCount || 0,
          audioEnabled: audioCount || 0
        });
      } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
      }
    };

    loadStats();
  }, []);

  const statCards = [
    {
      title: 'Utilisateurs Total',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Comptes Email Actifs',
      value: stats.activeEmails,
      icon: Mail,
      color: 'bg-green-500'
    },
    {
      title: 'Utilisateurs WhatsApp',
      value: stats.whatsappUsers,
      icon: MessageSquare,
      color: 'bg-purple-500'
    },
    {
      title: 'Audio Activé',
      value: stats.audioEnabled,
      icon: Volume2,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map(({ title, value, icon: Icon, color }) => (
          <div key={title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`${color} p-3 rounded-lg`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{title}</p>
                <p className="text-2xl font-semibold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;