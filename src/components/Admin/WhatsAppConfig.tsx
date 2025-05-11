import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { MessageSquare, Trash2, Check, AlertCircle, RefreshCw, Phone } from 'lucide-react';
import { verifyWhatsAppNumber } from '../../services/whatsapp';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';

interface WhatsAppUser {
  id: string;
  phone_number: string;
  created_at: string;
  updated_at: string;
}

const WhatsAppConfig: React.FC = () => {
  const [users, setUsers] = useState<WhatsAppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [isAddingNumber, setIsAddingNumber] = useState(false);
  const supabase = useSupabaseClient();

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_whatsapp')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      setError('Erreur lors du chargement des utilisateurs WhatsApp');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce numéro ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_whatsapp')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccess('Numéro supprimé avec succès');
      loadUsers();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de la suppression du numéro');
      console.error(err);
    }
  };

  const handleVerify = async (phoneNumber: string) => {
    try {
      setVerifying(phoneNumber);
      const isVerified = await verifyWhatsAppNumber(phoneNumber);
      
      setSuccess(isVerified 
        ? 'Numéro WhatsApp vérifié avec succès' 
        : 'Le numéro n\'est pas vérifié sur WhatsApp'
      );
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de la vérification du numéro');
      console.error(err);
    } finally {
      setVerifying(null);
    }
  };

  const handleAddNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPhoneNumber) {
      setError('Le numéro de téléphone est requis');
      return;
    }

    try {
      setIsAddingNumber(true);
      setError(null);

      // Vérifier si le numéro existe déjà
      const { data: existingNumber } = await supabase
        .from('user_whatsapp')
        .select('id')
        .eq('phone_number', newPhoneNumber)
        .single();

      if (existingNumber) {
        setError('Ce numéro est déjà enregistré');
        return;
      }

      // Ajouter le nouveau numéro
      const { error: insertError } = await supabase
        .from('user_whatsapp')
        .insert([{ phone_number: newPhoneNumber }]);

      if (insertError) throw insertError;

      setSuccess('Numéro WhatsApp ajouté avec succès');
      setNewPhoneNumber('');
      loadUsers();

      // Stocker le numéro dans localStorage
      localStorage.setItem('userWhatsAppNumber', newPhoneNumber);
    } catch (err) {
      setError('Erreur lors de l\'ajout du numéro');
      console.error(err);
    } finally {
      setIsAddingNumber(false);
    }
  };

  const setAsActive = async (phoneNumber: string) => {
    try {
      localStorage.setItem('userWhatsAppNumber', phoneNumber);
      setSuccess('Numéro défini comme actif avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de la définition du numéro actif');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  const activeNumber = localStorage.getItem('userWhatsAppNumber');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configuration WhatsApp</h1>

      {error && (
        <Alert variant="error" className="mb-4">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-700">{error}</p>
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="mb-4">
          <Check className="h-5 w-5 text-green-500 mr-2" />
          <p className="text-green-700">{success}</p>
        </Alert>
      )}

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Ajouter un numéro WhatsApp</h2>
        <form onSubmit={handleAddNumber} className="space-y-4">
          <div>
            <Input
              type="tel"
              value={newPhoneNumber}
              onChange={(e) => setNewPhoneNumber(e.target.value)}
              placeholder="+33612345678"
              leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
              helperText="Format international (ex: +33612345678)"
            />
          </div>
          <Button
            type="submit"
            disabled={isAddingNumber}
            className="w-full sm:w-auto"
          >
            {isAddingNumber ? 'Ajout en cours...' : 'Ajouter le numéro'}
          </Button>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-medium text-gray-700">Numéros WhatsApp enregistrés</h3>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Numéro WhatsApp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date d'ajout
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className={user.phone_number === activeNumber ? 'bg-green-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900">{user.phone_number}</span>
                    {user.phone_number === activeNumber && (
                      <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Actif
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    Connecté
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    {user.phone_number !== activeNumber && (
                      <Button
                        onClick={() => setAsActive(user.phone_number)}
                        variant="outline"
                        size="sm"
                      >
                        Définir comme actif
                      </Button>
                    )}
                    <button
                      onClick={() => handleVerify(user.phone_number)}
                      disabled={verifying === user.phone_number}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <RefreshCw className={`h-5 w-5 ${
                        verifying === user.phone_number ? 'animate-spin' : ''
                      }`} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  Aucun numéro WhatsApp enregistré
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WhatsAppConfig;