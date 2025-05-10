import React from 'react';
import { Mail, MessageSquare, Volume2, Users } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Card } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';

const Dashboard: React.FC = () => {
  const [stats, setStats] = React.useState({
    totalUsers: 0,
    activeEmails: 0,
    whatsappUsers: 0,
    audioEnabled: 0
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const supabase = useSupabaseClient();

  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Non authentifié');

        // Get stats only for the current user
        const [
          { count: emailCount },
          { count: whatsappCount },
          { count: audioCount }
        ] = await Promise.all([
          supabase
            .from('email_credentials')
            .select('*', { count: 'exact' })
            .eq('phone_number', user.phone),
          supabase
            .from('user_whatsapp')
            .select('*', { count: 'exact' })
            .eq('phone_number', user.phone),
          supabase
            .from('user_settings')
            .select('*', { count: 'exact' })
            .eq('user_id', user.id)
            .eq('audio_enabled', true)
        ]);

        setStats({
          totalUsers: 1, // Only current user
          activeEmails: emailCount || 0,
          whatsappUsers: whatsappCount || 0,
          audioEnabled: audioCount || 0
        });
      } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
        setError('Erreur lors du chargement des statistiques');
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" className="text-green-500" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" className="m-4">
        {error}
      </Alert>
    );
  }

  const statCards = [
    {
      title: 'Comptes Email Actifs',
      value: stats.activeEmails,
      icon: Mail,
      color: 'bg-green-500'
    },
    {
      title: 'Numéros WhatsApp',
      value: stats.whatsappUsers,
      icon: MessageSquare,
      color: 'bg-purple-500'
    },
    {
      title: 'Audio Activé',
      value: stats.audioEnabled ? 'Oui' : 'Non',
      icon: Volume2,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map(({ title, value, icon: Icon, color }) => (
          <Card key={title} className="p-6">
            <div className="flex items-center">
              <div className={`${color} p-3 rounded-lg`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{title}</p>
                <p className="text-2xl font-semibold text-gray-900">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;